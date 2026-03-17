package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/api"
	"github.com/aethelred/terraqura-indexer/internal/config"
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
		zap.String("rpc", cfg.RPCEndpoint),
		zap.Int("api_port", cfg.APIPort),
		zap.Uint64("start_block", cfg.StartBlock),
		zap.Int64("chain_id", cfg.ChainID),
	)

	dataStore := store.NewInMemoryStore()

	// Graceful shutdown context.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Start API server in a goroutine.
	server := api.NewServer(dataStore, cfg.APIPort, logger)
	go func() {
		if err := server.Start(ctx); err != nil {
			logger.Error("API server error", zap.Error(err))
			cancel()
		}
	}()

	// NOTE: The blockchain indexer loop requires a live RPC connection.
	// In production you would instantiate an indexer.BlockFetcher backed by
	// go-ethereum's ethclient and pass it to indexer.New(). For now we only
	// start the API server so the service is useful without an RPC endpoint.

	logger.Info("TerraQura Indexer running — press Ctrl+C to stop")

	// Block until shutdown signal.
	select {
	case sig := <-sigCh:
		logger.Info("received signal, shutting down", zap.String("signal", sig.String()))
		cancel()
	case <-ctx.Done():
	}

	logger.Info("TerraQura Indexer stopped")
}
