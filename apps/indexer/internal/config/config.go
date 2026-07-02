package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	legacyValidationOptInEnv       = "TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT"
	publicLegacyValidationOptInEnv = "NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT"
	zeroAddress                    = "0x0000000000000000000000000000000000000000"
)

// Config holds all configuration for the indexer service.
type Config struct {
	RPCEndpoint        string
	WSEndpoint         string
	APIPort            int
	DatabaseURL        string
	StartBlock         uint64
	ChainID            int64
	NetworkKey         string
	DeploymentKey      string
	ManifestPath       string
	ContractAddresses  []string
	Confirmations      uint64
	IndexerEnabled     bool
	AllowInMemoryStore bool
}

type PortableManifest struct {
	PrimaryNetworkKey        string                        `json:"primaryNetworkKey"`
	PrimaryTestnetNetworkKey string                        `json:"primaryTestnetNetworkKey"`
	Networks                 map[string]ManifestNetwork    `json:"networks"`
	Deployments              map[string]ManifestDeployment `json:"deployments"`
}

type ManifestNetwork struct {
	Key     string   `json:"key"`
	ChainID int64    `json:"chainId"`
	RPCURLs []string `json:"rpcUrls"`
	Role    string   `json:"role"`
}

type ManifestDeployment struct {
	Key       string            `json:"key"`
	Network   string            `json:"network"`
	Status    string            `json:"status"`
	Contracts map[string]string `json:"contracts"`
}

// Load reads configuration from environment variables and the portable
// network manifest shared by all TerraQura runtimes.
func Load() (*Config, error) {
	manifestPath := getEnvAny([]string{
		"TERRAQURA_NETWORK_MANIFEST_JSON",
		"NETWORK_MANIFEST_PATH",
	}, "")

	manifest, resolvedManifestPath, err := LoadManifest(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("loading network manifest: %w", err)
	}

	networkKey := getEnvAny([]string{"TERRAQURA_NETWORK", "NETWORK_KEY"}, manifest.PrimaryNetworkKey)
	network, ok := manifest.Networks[networkKey]
	if !ok {
		return nil, fmt.Errorf("unknown TerraQura network %q in %s", networkKey, resolvedManifestPath)
	}
	if err := assertRuntimeNetworkAllowed(networkKey, network); err != nil {
		return nil, err
	}

	deploymentKey := getEnvAny([]string{"TERRAQURA_DEPLOYMENT", "DEPLOYMENT_KEY"}, "")
	if deploymentKey == "" {
		deploymentKey = manifest.DefaultDeploymentForNetwork(networkKey)
	}

	deployment, ok := manifest.Deployments[deploymentKey]
	if !ok {
		return nil, fmt.Errorf("unknown TerraQura deployment %q in %s", deploymentKey, resolvedManifestPath)
	}
	if deployment.Network != networkKey {
		return nil, fmt.Errorf("deployment %q belongs to network %q, not %q", deploymentKey, deployment.Network, networkKey)
	}

	defaultRPC := ""
	if len(network.RPCURLs) > 0 {
		defaultRPC = network.RPCURLs[0]
	}

	chainID, err := getEnvInt64("CHAIN_ID", network.ChainID)
	if err != nil {
		return nil, err
	}
	if chainID != network.ChainID {
		return nil, fmt.Errorf("CHAIN_ID %d does not match manifest network %q chain ID %d", chainID, networkKey, network.ChainID)
	}

	startBlock, err := getEnvUint64("START_BLOCK", 0)
	if err != nil {
		return nil, err
	}
	confirmations, err := getEnvUint64("INDEXER_CONFIRMATIONS", 6)
	if err != nil {
		return nil, err
	}

	contractAddresses := contractAddressesFromDeployment(deployment)
	if override := getEnvAny([]string{
		"TERRAQURA_INDEXER_CONTRACT_ADDRESSES",
		"INDEXER_CONTRACT_ADDRESSES",
	}, ""); override != "" {
		contractAddresses = splitCSV(override)
	}

	indexerEnabled := len(contractAddresses) > 0
	if raw, ok := os.LookupEnv("INDEXER_ENABLED"); ok {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			return nil, fmt.Errorf("INDEXER_ENABLED must be boolean: %w", err)
		}
		indexerEnabled = parsed
	}
	if indexerEnabled && len(contractAddresses) == 0 {
		return nil, fmt.Errorf("INDEXER_ENABLED=true requires deployed contract addresses in the manifest or INDEXER_CONTRACT_ADDRESSES")
	}

	allowInMemoryStore, err := getEnvBool("INDEXER_ALLOW_IN_MEMORY_STORE", false)
	if err != nil {
		return nil, err
	}
	databaseURL := getEnv("DATABASE_URL", "")
	if indexerEnabled && databaseURL == "" && !allowInMemoryStore {
		return nil, fmt.Errorf("live indexing requires DATABASE_URL; set INDEXER_ALLOW_IN_MEMORY_STORE=true only for local drills")
	}

	cfg := &Config{
		RPCEndpoint:        getEnv("RPC_ENDPOINT", defaultRPC),
		WSEndpoint:         getEnv("WS_ENDPOINT", ""),
		APIPort:            getEnvInt("API_PORT", 8080),
		DatabaseURL:        databaseURL,
		StartBlock:         startBlock,
		ChainID:            chainID,
		NetworkKey:         networkKey,
		DeploymentKey:      deploymentKey,
		ManifestPath:       resolvedManifestPath,
		ContractAddresses:  contractAddresses,
		Confirmations:      confirmations,
		IndexerEnabled:     indexerEnabled,
		AllowInMemoryStore: allowInMemoryStore,
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return cfg, nil
}

// LoadManifest loads the portable network manifest from an explicit path or a
// small set of repo-relative fallbacks used by local development and tests.
func LoadManifest(explicitPath string) (*PortableManifest, string, error) {
	for _, candidate := range manifestCandidates(explicitPath) {
		if candidate == "" {
			continue
		}
		data, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}

		var manifest PortableManifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			return nil, candidate, err
		}
		if len(manifest.Networks) == 0 {
			return nil, candidate, fmt.Errorf("manifest has no networks")
		}
		if len(manifest.Deployments) == 0 {
			return nil, candidate, fmt.Errorf("manifest has no deployments")
		}
		return &manifest, candidate, nil
	}

	return nil, "", fmt.Errorf("not found; set TERRAQURA_NETWORK_MANIFEST_JSON")
}

func (m *PortableManifest) DefaultDeploymentForNetwork(networkKey string) string {
	for key, deployment := range m.Deployments {
		if deployment.Network == networkKey {
			return key
		}
	}
	return ""
}

// Validate checks that all required configuration values are present and valid.
func (c *Config) Validate() error {
	if c.NetworkKey == "" {
		return fmt.Errorf("TERRAQURA_NETWORK is required")
	}
	if c.DeploymentKey == "" {
		return fmt.Errorf("TERRAQURA_DEPLOYMENT is required")
	}
	if c.RPCEndpoint == "" {
		return fmt.Errorf("RPC_ENDPOINT is required")
	}
	if c.APIPort < 1 || c.APIPort > 65535 {
		return fmt.Errorf("API_PORT must be between 1 and 65535, got %d", c.APIPort)
	}
	if c.ChainID < 1 {
		return fmt.Errorf("CHAIN_ID must be positive, got %d", c.ChainID)
	}
	return nil
}

func manifestCandidates(explicitPath string) []string {
	candidates := []string{}
	if explicitPath != "" {
		candidates = append(candidates, explicitPath)
	}

	candidates = append(candidates,
		filepath.Join("packages", "network-manifest", "manifest.json"),
		filepath.Join("..", "..", "packages", "network-manifest", "manifest.json"),
		filepath.Join("..", "..", "..", "packages", "network-manifest", "manifest.json"),
		filepath.Join("..", "..", "..", "..", "packages", "network-manifest", "manifest.json"),
	)

	return candidates
}

func contractAddressesFromDeployment(deployment ManifestDeployment) []string {
	addresses := make([]string, 0, len(deployment.Contracts))
	for _, address := range deployment.Contracts {
		normalized := strings.ToLower(strings.TrimSpace(address))
		if normalized == "" || normalized == zeroAddress {
			continue
		}
		addresses = append(addresses, address)
	}
	return addresses
}

func assertRuntimeNetworkAllowed(networkKey string, network ManifestNetwork) error {
	if network.Role != "legacy-validation" {
		return nil
	}
	if legacyValidationOptInEnabled() {
		return nil
	}
	return fmt.Errorf(
		"network %q is marked as legacy validation evidence; set %s=true only for historical validation drills",
		networkKey,
		legacyValidationOptInEnv,
	)
}

func legacyValidationOptInEnabled() bool {
	return strings.EqualFold(os.Getenv(legacyValidationOptInEnv), "true") ||
		strings.EqualFold(os.Getenv(publicLegacyValidationOptInEnv), "true")
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func getEnvAny(keys []string, fallback string) string {
	for _, key := range keys {
		if val, ok := os.LookupEnv(key); ok {
			return val
		}
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvInt64(key string, fallback int64) (int64, error) {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback, nil
	}
	n, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return n, nil
}

func getEnvUint64(key string, fallback uint64) (uint64, error) {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback, nil
	}
	n, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an unsigned integer: %w", key, err)
	}
	return n, nil
}

func getEnvBool(key string, fallback bool) (bool, error) {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(val)
	if err != nil {
		return false, fmt.Errorf("%s must be boolean: %w", key, err)
	}
	return parsed, nil
}
