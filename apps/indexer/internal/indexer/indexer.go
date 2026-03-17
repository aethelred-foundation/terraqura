package indexer

import (
	"context"
	"fmt"
	"time"

	"github.com/ethereum/go-ethereum/core/types"
	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/config"
	"github.com/aethelred/terraqura-indexer/internal/store"
)

// BlockFetcher abstracts the blockchain data source so the indexer can be
// tested without a real Ethereum client.
type BlockFetcher interface {
	// BlockLogs returns all logs for the given block number.
	BlockLogs(ctx context.Context, blockNum uint64) ([]types.Log, error)
	// LatestBlock returns the latest confirmed block number on chain.
	LatestBlock(ctx context.Context) (uint64, error)
}

// Indexer is the core event-processing pipeline.
type Indexer struct {
	fetcher    BlockFetcher
	store      store.Store
	logger     *zap.Logger
	cfg        *config.Config
	startTime  time.Time
	pollPeriod time.Duration
}

// New creates an Indexer.
func New(fetcher BlockFetcher, st store.Store, logger *zap.Logger, cfg *config.Config) *Indexer {
	return &Indexer{
		fetcher:    fetcher,
		store:      st,
		logger:     logger,
		cfg:        cfg,
		startTime:  time.Now(),
		pollPeriod: 2 * time.Second,
	}
}

// Start runs the main indexing loop until the context is cancelled.
func (idx *Indexer) Start(ctx context.Context) error {
	lastBlock, err := idx.store.GetLatestBlock()
	if err != nil {
		return fmt.Errorf("getting latest block from store: %w", err)
	}

	// Use the configured start block if the store has never been written to.
	if lastBlock == 0 && idx.cfg.StartBlock > 0 {
		lastBlock = idx.cfg.StartBlock - 1
	}

	idx.logger.Info("indexer starting", zap.Uint64("resume_block", lastBlock+1))

	ticker := time.NewTicker(idx.pollPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			idx.logger.Info("indexer stopping")
			return ctx.Err()
		case <-ticker.C:
			chainHead, err := idx.fetcher.LatestBlock(ctx)
			if err != nil {
				idx.logger.Error("failed to get chain head", zap.Error(err))
				continue
			}

			for blockNum := lastBlock + 1; blockNum <= chainHead; blockNum++ {
				if err := ctx.Err(); err != nil {
					return err
				}
				if err := idx.ProcessBlock(ctx, blockNum); err != nil {
					idx.logger.Error("processing block", zap.Uint64("block", blockNum), zap.Error(err))
					break
				}
				lastBlock = blockNum
			}
		}
	}
}

// ProcessBlock fetches logs for a single block and processes each one.
func (idx *Indexer) ProcessBlock(ctx context.Context, blockNum uint64) error {
	logs, err := idx.fetcher.BlockLogs(ctx, blockNum)
	if err != nil {
		return fmt.Errorf("fetching logs for block %d: %w", blockNum, err)
	}

	for _, l := range logs {
		if err := idx.ProcessLog(l); err != nil {
			idx.logger.Warn("processing log",
				zap.String("tx", l.TxHash.Hex()),
				zap.Uint("index", l.Index),
				zap.Error(err),
			)
			// Continue processing other logs in the block.
		}
	}

	if err := idx.store.SetLatestBlock(blockNum); err != nil {
		return fmt.Errorf("setting latest block: %w", err)
	}

	idx.logger.Debug("processed block", zap.Uint64("block", blockNum), zap.Int("logs", len(logs)))
	return nil
}

// ProcessLog decodes a single Ethereum log and stores the resulting event.
func (idx *Indexer) ProcessLog(log types.Log) error {
	ev, err := DecodeEvent(log)
	if err != nil {
		return fmt.Errorf("decoding event: %w", err)
	}

	ev.Timestamp = time.Now()

	if err := idx.store.SaveEvent(ev); err != nil {
		return fmt.Errorf("saving event: %w", err)
	}

	idx.logger.Debug("indexed event",
		zap.String("type", string(ev.Type)),
		zap.Uint64("block", ev.BlockNumber),
		zap.String("tx", ev.TxHash),
	)
	return nil
}

// HandleReorg rolls back events from the given block number and above.
func (idx *Indexer) HandleReorg(blockNum uint64) error {
	idx.logger.Warn("handling chain reorg", zap.Uint64("from_block", blockNum))
	if err := idx.store.DeleteEventsFromBlock(blockNum); err != nil {
		return fmt.Errorf("deleting events from block %d: %w", blockNum, err)
	}
	return nil
}

// Uptime returns how long the indexer has been running.
func (idx *Indexer) Uptime() time.Duration {
	return time.Since(idx.startTime)
}
