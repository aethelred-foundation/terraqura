# =============================================================================
# TerraQura Production Infrastructure - Terraform Configuration
# =============================================================================
#
# This configuration deploys TerraQura to AWS Middle East (Bahrain) region
# for ADGM compliance and UAE data residency requirements.
#
# Architecture:
# - VPC with public/private subnets across 2 AZs
# - EKS cluster for container orchestration
# - RDS PostgreSQL with TimescaleDB extension
# - ElastiCache Redis cluster for job queues
# - Application Load Balancer with WAF
# - CloudWatch for monitoring and alerting
# - S3 for static assets and backups
# - Secrets Manager for sensitive configuration
#
# Estimated Monthly Cost: $3,000 - $5,000 (production workload)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "terraqura-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "me-south-1"
    encrypt        = true
    dynamodb_table = "terraqura-terraform-locks"
  }
}

# =============================================================================
# Provider Configuration
# =============================================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TerraQura"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "ADGM"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "me-south-1" # Middle East (Bahrain) for ADGM compliance
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large" # 2 vCPU, 16 GB RAM
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "eks_node_instance_type" {
  description = "EKS worker node instance type"
  type        = string
  default     = "m6i.xlarge" # 4 vCPU, 16 GB RAM
}

variable "eks_desired_capacity" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 3
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "app.terraqura.io"
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# VPC Configuration
# =============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "terraqura-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false # HA: NAT gateway per AZ
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # VPC Flow Logs for security monitoring
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
  flow_log_max_aggregation_interval    = 60

  tags = {
    "kubernetes.io/cluster/terraqura-${var.environment}" = "shared"
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/terraqura-${var.environment}" = "shared"
    "kubernetes.io/role/elb"                             = 1
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/terraqura-${var.environment}" = "shared"
    "kubernetes.io/role/internal-elb"                    = 1
  }
}

# =============================================================================
# EKS Cluster
# =============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "terraqura-${var.environment}"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Encryption at rest
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }

  # Managed node groups
  eks_managed_node_groups = {
    main = {
      name           = "terraqura-main"
      instance_types = [var.eks_node_instance_type]

      min_size     = 2
      max_size     = 10
      desired_size = var.eks_desired_capacity

      # Use latest Amazon Linux 2 EKS-optimized AMI
      ami_type = "AL2_x86_64"

      # Disk encryption
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 100
            volume_type           = "gp3"
            encrypted             = true
            kms_key_id            = aws_kms_key.ebs.arn
            delete_on_termination = true
          }
        }
      }

      labels = {
        Environment = var.environment
        NodeGroup   = "main"
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled"                      = "true"
        "k8s.io/cluster-autoscaler/terraqura-${var.environment}" = "owned"
      }
    }
  }

  # Cluster add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa_role.iam_role_arn
    }
  }

  tags = {
    Environment = var.environment
  }
}

# EBS CSI Driver IAM Role
module "ebs_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "terraqura-${var.environment}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

# =============================================================================
# RDS PostgreSQL with TimescaleDB
# =============================================================================

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "terraqura-${var.environment}"

  engine               = "postgres"
  engine_version       = "15.4"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = var.db_instance_class

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = "terraqura"
  username = "terraqura_admin"
  port     = 5432

  # Multi-AZ for high availability
  multi_az = true

  # Subnet group
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Backup configuration
  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id       = aws_kms_key.rds.arn

  # Enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Deletion protection for production
  deletion_protection = true

  # Parameter group for TimescaleDB
  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "timescaledb"
    },
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries > 1 second
    }
  ]

  tags = {
    Environment = var.environment
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name_prefix = "terraqura-${var.environment}-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
    description     = "PostgreSQL from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "terraqura-${var.environment}-rds"
  }
}

# RDS Monitoring IAM Role
resource "aws_iam_role" "rds_monitoring" {
  name = "terraqura-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# =============================================================================
# ElastiCache Redis
# =============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "terraqura-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "terraqura-${var.environment}"
  description          = "TerraQura Redis cluster"

  node_type            = var.redis_node_type
  num_cache_clusters   = 2 # Primary + 1 replica
  parameter_group_name = "default.redis7"
  port                 = 6379
  engine_version       = "7.0"

  # Multi-AZ with automatic failover
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.redis.arn

  # Auth
  auth_token = random_password.redis_auth.result

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 7
  snapshot_window          = "04:00-05:00"

  tags = {
    Environment = var.environment
  }
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_security_group" "redis" {
  name_prefix = "terraqura-${var.environment}-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
    description     = "Redis from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "terraqura-${var.environment}-redis"
  }
}

# =============================================================================
# KMS Keys
# =============================================================================

resource "aws_kms_key" "eks" {
  description             = "TerraQura EKS encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "terraqura-${var.environment}-eks"
  }
}

resource "aws_kms_key" "ebs" {
  description             = "TerraQura EBS encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "terraqura-${var.environment}-ebs"
  }
}

resource "aws_kms_key" "rds" {
  description             = "TerraQura RDS encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "terraqura-${var.environment}-rds"
  }
}

resource "aws_kms_key" "redis" {
  description             = "TerraQura Redis encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "terraqura-${var.environment}-redis"
  }
}

resource "aws_kms_key" "secrets" {
  description             = "TerraQura Secrets Manager encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "terraqura-${var.environment}-secrets"
  }
}

# =============================================================================
# Secrets Manager
# =============================================================================

resource "aws_secretsmanager_secret" "db_credentials" {
  name       = "terraqura/${var.environment}/db-credentials"
  kms_key_id = aws_kms_key.secrets.arn

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name       = "terraqura/${var.environment}/redis-credentials"
  kms_key_id = aws_kms_key.secrets.arn

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth.result
    endpoint   = aws_elasticache_replication_group.main.primary_endpoint_address
  })
}

# =============================================================================
# S3 Buckets
# =============================================================================

resource "aws_s3_bucket" "assets" {
  bucket = "terraqura-${var.environment}-assets-${data.aws_caller_identity.current.account_id}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.secrets.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Backup bucket
resource "aws_s3_bucket" "backups" {
  bucket = "terraqura-${var.environment}-backups-${data.aws_caller_identity.current.account_id}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# =============================================================================
# CloudWatch Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "terraqura-${var.environment}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "terraqura-${var.environment}-redis-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }
}

resource "aws_sns_topic" "alerts" {
  name = "terraqura-${var.environment}-alerts"
}

# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "assets_bucket" {
  description = "Assets S3 bucket"
  value       = aws_s3_bucket.assets.id
}

output "backups_bucket" {
  description = "Backups S3 bucket"
  value       = aws_s3_bucket.backups.id
}
