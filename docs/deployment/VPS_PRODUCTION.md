# TerraQura VPS production deployment

This runbook deploys the TerraQura API, worker, PostgreSQL/TimescaleDB, and
Redis as a private backend stack. Only the API is bound to the host loopback
interface on port `4000`; TLS must terminate at the existing reverse proxy.

## Prerequisites

- Docker Engine with the Compose v2 plugin
- An HTTPS hostname for the API, such as
  `api.terraqura.aethelred.network`
- DNS for that hostname pointing to the backend host
- A reverse proxy forwarding HTTPS traffic to `127.0.0.1:4000`
- Production KYC, signer, sensor, database, Redis, and JWT secrets

Do not expose ports 5432 or 6379 on the host firewall.

## Configure

```bash
cp deploy/terraqura.production.env.example .env
chmod 600 .env
```

Replace every blank value. `JWT_SECRET` must contain at least 32 random
characters. The on-chain addresses, chain ID, and RPC endpoint must be verified
against the current testnet deployment manifest before starting the stack.

## Validate and start

```bash
docker compose --env-file .env -f docker-compose.production.yml config --quiet
docker compose --env-file .env -f docker-compose.production.yml build
docker compose --env-file .env -f docker-compose.production.yml up -d
docker compose --env-file .env -f docker-compose.production.yml ps
```

The API is ready only when both PostgreSQL and Aethelred RPC checks pass:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:4000/v1/health/ready
```

After the reverse proxy is active, verify the public TLS endpoint:

```bash
curl --fail --silent --show-error \
  https://api.terraqura.aethelred.network/v1/health/ready
```

Set `TERRAQURA_API_ORIGIN` in the Vercel TerraQura project to that HTTPS API
origin. The browser uses the same-origin `/api/terraqura` gateway, so backend
topology and CORS details are not exposed to end users.

## Upgrade

Build first, then replace services with health-gated containers:

```bash
git pull --ff-only
docker compose --env-file .env -f docker-compose.production.yml build
docker compose --env-file .env -f docker-compose.production.yml up -d
docker compose --env-file .env -f docker-compose.production.yml ps
```

Never run multiple worker revisions against the same queues during a schema or
job-payload migration. Add an explicit compatibility handler before such an
upgrade.

## Rollback

Check out the last verified commit, rebuild, and start the stack again. Database
schema changes require a tested backward migration or a point-in-time restore;
do not treat container rollback as database rollback.
