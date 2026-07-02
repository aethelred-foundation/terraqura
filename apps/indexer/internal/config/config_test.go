package config

import (
	"os"
	"strings"
	"testing"
)

func TestLoadUsesPortableManifestDefaults(t *testing.T) {
	clearEnv(t,
		"TERRAQURA_NETWORK",
		"NETWORK_KEY",
		"TERRAQURA_DEPLOYMENT",
		"DEPLOYMENT_KEY",
		"CHAIN_ID",
		"RPC_ENDPOINT",
		"INDEXER_ENABLED",
		"INDEXER_ALLOW_IN_MEMORY_STORE",
		"TERRAQURA_INDEXER_CONTRACT_ADDRESSES",
		"INDEXER_CONTRACT_ADDRESSES",
		"DATABASE_URL",
	)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.NetworkKey != "aethelred" {
		t.Fatalf("NetworkKey = %q, want aethelred", cfg.NetworkKey)
	}
	if cfg.ChainID != 7331 {
		t.Fatalf("ChainID = %d, want 7331", cfg.ChainID)
	}
	if cfg.RPCEndpoint != "https://rpc.aethelred.network" {
		t.Fatalf("RPCEndpoint = %q", cfg.RPCEndpoint)
	}
	if cfg.IndexerEnabled {
		t.Fatalf("IndexerEnabled = true, want false for pending deployment without contract filters")
	}
}

func TestLoadSupportsAethelredTestnet(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT", "INDEXER_ENABLED")
	t.Setenv("TERRAQURA_NETWORK", "aethelredTestnet")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.DeploymentKey != "aethelredTestnetPending" {
		t.Fatalf("DeploymentKey = %q, want aethelredTestnetPending", cfg.DeploymentKey)
	}
	if cfg.ChainID != 7332 {
		t.Fatalf("ChainID = %d, want 7332", cfg.ChainID)
	}
	if !strings.Contains(cfg.RPCEndpoint, "rpc-testnet.aethelred.network") {
		t.Fatalf("RPCEndpoint = %q", cfg.RPCEndpoint)
	}
}

func TestLoadRejectsChainIDDrift(t *testing.T) {
	clearEnv(t, "RPC_ENDPOINT", "INDEXER_ENABLED")
	t.Setenv("TERRAQURA_NETWORK", "aethelred")
	t.Setenv("CHAIN_ID", "1")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want chain mismatch error")
	}
	if !strings.Contains(err.Error(), "does not match manifest") {
		t.Fatalf("Load() error = %v", err)
	}
}

func TestLoadRejectsLegacyValidationNetworkWithoutOptIn(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT", "INDEXER_ENABLED")
	t.Setenv("TERRAQURA_NETWORK", "polygonAmoy")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want legacy validation error")
	}
	if !strings.Contains(err.Error(), "legacy validation evidence") {
		t.Fatalf("Load() error = %v", err)
	}
}

func TestLoadAllowsLegacyValidationNetworkWithExplicitOptIn(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT", "INDEXER_ENABLED")
	t.Setenv("TERRAQURA_NETWORK", "polygonAmoy")
	t.Setenv("INDEXER_ENABLED", "false")
	t.Setenv(legacyValidationOptInEnv, "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.NetworkKey != "polygonAmoy" {
		t.Fatalf("NetworkKey = %q, want polygonAmoy", cfg.NetworkKey)
	}
	if cfg.DeploymentKey != "polygonAmoyV3Final" {
		t.Fatalf("DeploymentKey = %q, want polygonAmoyV3Final", cfg.DeploymentKey)
	}
	if cfg.ChainID != 80002 {
		t.Fatalf("ChainID = %d, want 80002", cfg.ChainID)
	}
}

func TestLoadRejectsEnabledIndexerWithoutFilters(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT")
	t.Setenv("TERRAQURA_NETWORK", "aethelred")
	t.Setenv("INDEXER_ENABLED", "true")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want missing filter error")
	}
	if !strings.Contains(err.Error(), "requires deployed contract addresses") {
		t.Fatalf("Load() error = %v", err)
	}
}

func TestLoadRequiresPersistentStoreForLiveIndexing(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT", "DATABASE_URL", "INDEXER_ALLOW_IN_MEMORY_STORE")
	t.Setenv("TERRAQURA_NETWORK", "aethelred")
	t.Setenv("INDEXER_ENABLED", "true")
	t.Setenv("INDEXER_CONTRACT_ADDRESSES", "0x1111111111111111111111111111111111111111")

	_, err := Load()
	if err == nil {
		t.Fatal("Load() error = nil, want DATABASE_URL requirement")
	}
	if !strings.Contains(err.Error(), "live indexing requires DATABASE_URL") {
		t.Fatalf("Load() error = %v", err)
	}
}

func TestLoadAllowsExplicitInMemoryDrillMode(t *testing.T) {
	clearEnv(t, "CHAIN_ID", "RPC_ENDPOINT", "DATABASE_URL")
	t.Setenv("TERRAQURA_NETWORK", "aethelred")
	t.Setenv("INDEXER_ENABLED", "true")
	t.Setenv("INDEXER_ALLOW_IN_MEMORY_STORE", "true")
	t.Setenv("INDEXER_CONTRACT_ADDRESSES", "0x1111111111111111111111111111111111111111")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if !cfg.IndexerEnabled {
		t.Fatal("IndexerEnabled = false, want true")
	}
	if !cfg.AllowInMemoryStore {
		t.Fatal("AllowInMemoryStore = false, want true")
	}
}

func clearEnv(t *testing.T, keys ...string) {
	t.Helper()

	keys = append(keys, legacyValidationOptInEnv, publicLegacyValidationOptInEnv)
	for _, key := range keys {
		oldValue, hadValue := os.LookupEnv(key)
		if err := os.Unsetenv(key); err != nil {
			t.Fatalf("Unsetenv(%s) error = %v", key, err)
		}
		t.Cleanup(func(key, oldValue string, hadValue bool) func() {
			return func() {
				if hadValue {
					_ = os.Setenv(key, oldValue)
				} else {
					_ = os.Unsetenv(key)
				}
			}
		}(key, oldValue, hadValue))
	}
}
