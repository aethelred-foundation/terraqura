package indexer

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// EthereumBlockFetcher reads confirmed blocks and logs from an EVM RPC node.
type EthereumBlockFetcher struct {
	client        *ethclient.Client
	addresses     []common.Address
	confirmations uint64
}

func NewEthereumBlockFetcher(client *ethclient.Client, addresses []common.Address, confirmations uint64) *EthereumBlockFetcher {
	return &EthereumBlockFetcher{
		client:        client,
		addresses:     addresses,
		confirmations: confirmations,
	}
}

func (f *EthereumBlockFetcher) LatestBlock(ctx context.Context) (uint64, error) {
	header, err := f.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return 0, err
	}

	head := header.Number.Uint64()
	if head <= f.confirmations {
		return 0, nil
	}
	return head - f.confirmations, nil
}

func (f *EthereumBlockFetcher) BlockLogs(ctx context.Context, blockNum uint64) ([]types.Log, error) {
	block := new(big.Int).SetUint64(blockNum)
	return f.client.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: block,
		ToBlock:   block,
		Addresses: f.addresses,
	})
}
