package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/api"
	"github.com/aethelred/terraqura-indexer/internal/config"
	"github.com/aethelred/terraqura-indexer/internal/indexer"
	"github.com/aethelred/terraqura-indexer/internal/store"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialise logger: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = logger.Sync() }()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("loading config", zap.Error(err))
	}

	logger.Info("TerraQura Indexer starting",
		zap.String("network", cfg.NetworkKey),
		zap.String("deployment", cfg.DeploymentKey),
		zap.String("rpc", cfg.RPCEndpoint),
		zap.Int("api_port", cfg.APIPort),
		zap.Uint64("start_block", cfg.StartBlock),
		zap.Int64("chain_id", cfg.ChainID),
		zap.Bool("indexer_enabled", cfg.IndexerEnabled),
		zap.Int("contract_filters", len(cfg.ContractAddresses)),
	)

	// Graceful shutdown context.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var dataStore store.Store
	var closeStore func()
	storeBackend := "memory"
	if cfg.DatabaseURL != "" {
		postgresStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
		if err != nil {
			logger.Fatal("initialising Postgres indexer store", zap.Error(err))
		}
		dataStore = postgresStore
		closeStore = postgresStore.Close
		storeBackend = "postgres"
		logger.Info("using Postgres indexer store")
	} else {
		dataStore = store.NewInMemoryStore()
		closeStore = func() {}
		logger.Warn("using in-memory indexer store; this is only safe for local drills")
	}
	defer closeStore()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Start API server in a goroutine.
	server := api.NewServer(dataStore, cfg.APIPort, logger, api.RuntimeInfo{
		NetworkKey:          cfg.NetworkKey,
		DeploymentKey:       cfg.DeploymentKey,
		ChainID:             cfg.ChainID,
		ManifestPath:        cfg.ManifestPath,
		StoreBackend:        storeBackend,
		IndexerEnabled:      cfg.IndexerEnabled,
		ContractFilterCount: len(cfg.ContractAddresses),
		Confirmations:       cfg.Confirmations,
	})
	go func() {
		if err := server.Start(ctx); err != nil {
			logger.Error("API server error", zap.Error(err))
			cancel()
		}
	}()

	if cfg.IndexerEnabled {
		client, err := ethclient.DialContext(ctx, cfg.RPCEndpoint)
		if err != nil {
			logger.Fatal("connecting to RPC endpoint", zap.Error(err))
		}
		defer client.Close()

		chainID, err := client.ChainID(ctx)
		if err != nil {
			logger.Fatal("reading RPC chain ID", zap.Error(err))
		}
		if chainID.Int64() != cfg.ChainID {
			logger.Fatal("RPC chain ID does not match manifest",
				zap.Int64("rpc_chain_id", chainID.Int64()),
				zap.Int64("manifest_chain_id", cfg.ChainID),
				zap.String("network", cfg.NetworkKey),
			)
		}

		addresses := make([]common.Address, 0, len(cfg.ContractAddresses))
		for _, address := range cfg.ContractAddresses {
			if !common.IsHexAddress(address) {
				logger.Fatal("invalid indexer contract address", zap.String("address", address))
			}
			addresses = append(addresses, common.HexToAddress(address))
		}

		blockFetcher := indexer.NewEthereumBlockFetcher(client, addresses, cfg.Confirmations)
		eventIndexer := indexer.New(blockFetcher, dataStore, logger, cfg)

		go func() {
			if err := eventIndexer.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
				logger.Error("blockchain indexer error", zap.Error(err))
				cancel()
			}
		}()

		logger.Info("blockchain indexer enabled",
			zap.Uint64("confirmations", cfg.Confirmations),
			zap.Int("contract_filters", len(addresses)),
		)
	} else {
		logger.Warn("blockchain indexer disabled because no deployed contract filters are configured",
			zap.String("network", cfg.NetworkKey),
			zap.String("deployment", cfg.DeploymentKey),
		)
	}

	logger.Info("TerraQura Indexer running; press Ctrl+C to stop")

	// Block until shutdown signal.
	select {
	case sig := <-sigCh:
		logger.Info("received signal, shutting down", zap.String("signal", sig.String()))
		cancel()
	case <-ctx.Done():
	}

	logger.Info("TerraQura Indexer stopped")
}
