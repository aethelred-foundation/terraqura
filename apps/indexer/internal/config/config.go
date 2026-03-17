package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for the indexer service.
type Config struct {
	RPCEndpoint string
	WSEndpoint  string
	APIPort     int
	DatabaseURL string
	StartBlock  uint64
	ChainID     int64
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		RPCEndpoint: getEnv("RPC_ENDPOINT", "http://localhost:8545"),
		WSEndpoint:  getEnv("WS_ENDPOINT", "ws://localhost:8546"),
		APIPort:     getEnvInt("API_PORT", 8080),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		StartBlock:  uint64(getEnvInt("START_BLOCK", 0)),
		ChainID:     int64(getEnvInt("CHAIN_ID", 1)),
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return cfg, nil
}

// Validate checks that all required configuration values are present and valid.
func (c *Config) Validate() error {
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

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
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
