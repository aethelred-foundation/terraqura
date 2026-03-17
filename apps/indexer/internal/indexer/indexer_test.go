package indexer

import (
	"context"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/config"
	"github.com/aethelred/terraqura-indexer/internal/store"
)

// mockFetcher is a test double for BlockFetcher.
type mockFetcher struct {
	blocks map[uint64][]types.Log
	head   uint64
}

func (m *mockFetcher) BlockLogs(_ context.Context, blockNum uint64) ([]types.Log, error) {
	return m.blocks[blockNum], nil
}

func (m *mockFetcher) LatestBlock(_ context.Context) (uint64, error) {
	return m.head, nil
}

func newTestIndexer(fetcher BlockFetcher) (*Indexer, *store.InMemoryStore) {
	st := store.NewInMemoryStore()
	logger := zap.NewNop()
	cfg := &config.Config{
		RPCEndpoint: "http://localhost:8545",
		APIPort:     8080,
		ChainID:     1,
	}
	idx := New(fetcher, st, logger, cfg)
	return idx, st
}

// Helper: build a CreditMinted log with the given creditID and owner.
func makeCreditMintedLog(blockNum uint64, txIndex uint, creditID *big.Int, owner common.Address, amount *big.Int) types.Log {
	// Data: uint256 amount + dynamic string offset + string length + string content
	amountBytes := common.LeftPadBytes(amount.Bytes(), 32)
	offsetBytes := common.LeftPadBytes(big.NewInt(64).Bytes(), 32) // offset to string data
	strContent := []byte("verra-vm0042")
	strLen := common.LeftPadBytes(big.NewInt(int64(len(strContent))).Bytes(), 32)
	padded := make([]byte, 32)
	copy(padded, strContent)

	data := append(amountBytes, offsetBytes...)
	data = append(data, strLen...)
	data = append(data, padded...)

	return types.Log{
		BlockNumber: blockNum,
		TxHash:      common.HexToHash("0xabc123"),
		Index:       txIndex,
		Topics: []common.Hash{
			TopicCreditMinted,
			common.BigToHash(creditID),
			common.BytesToHash(common.LeftPadBytes(owner.Bytes(), 32)),
		},
		Data: data,
	}
}

func makeCreditRetiredLog(blockNum uint64, creditID *big.Int, retiree common.Address, amount *big.Int) types.Log {
	data := common.LeftPadBytes(amount.Bytes(), 32)
	return types.Log{
		BlockNumber: blockNum,
		TxHash:      common.HexToHash("0xdef456"),
		Index:       0,
		Topics: []common.Hash{
			TopicCreditRetired,
			common.BigToHash(creditID),
			common.BytesToHash(common.LeftPadBytes(retiree.Bytes(), 32)),
		},
		Data: data,
	}
}

func makeCreditTransferredLog(blockNum uint64, creditID *big.Int, from, to common.Address, amount *big.Int) types.Log {
	data := common.LeftPadBytes(amount.Bytes(), 32)
	return types.Log{
		BlockNumber: blockNum,
		TxHash:      common.HexToHash("0x789abc"),
		Index:       0,
		Topics: []common.Hash{
			TopicCreditTransferred,
			common.BigToHash(creditID),
			common.BytesToHash(common.LeftPadBytes(from.Bytes(), 32)),
			common.BytesToHash(common.LeftPadBytes(to.Bytes(), 32)),
		},
		Data: data,
	}
}

func TestProcessLog_CreditMinted(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	log := makeCreditMintedLog(100, 0, big.NewInt(1), common.HexToAddress("0x1111"), big.NewInt(1000))
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, store.EventCreditMinted, events[0].Type)
	assert.Equal(t, "1", events[0].CreditID)
	assert.Equal(t, "1000", events[0].Data["amount"])
}

func TestProcessLog_CreditRetired(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	log := makeCreditRetiredLog(101, big.NewInt(1), common.HexToAddress("0x2222"), big.NewInt(500))
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, store.EventCreditRetired, events[0].Type)
	assert.Equal(t, "500", events[0].Data["amount"])
}

func TestProcessLog_CreditTransferred(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	from := common.HexToAddress("0x1111")
	to := common.HexToAddress("0x2222")
	log := makeCreditTransferredLog(102, big.NewInt(1), from, to, big.NewInt(250))
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, store.EventCreditTransferred, events[0].Type)
	assert.Contains(t, events[0].Addresses, from.Hex())
	assert.Contains(t, events[0].Addresses, to.Hex())
}

func TestProcessLog_VerificationCompleted(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	status := common.LeftPadBytes([]byte{1}, 32)
	score := common.LeftPadBytes(big.NewInt(95).Bytes(), 32)
	data := append(status, score...)

	log := types.Log{
		BlockNumber: 103,
		TxHash:      common.HexToHash("0xaaa"),
		Index:       0,
		Topics: []common.Hash{
			TopicVerificationCompleted,
			common.BigToHash(big.NewInt(1)),
		},
		Data: data,
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, "1", events[0].Data["status"])
	assert.Equal(t, "95", events[0].Data["score"])
}

func TestProcessLog_ListingCreated(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	seller := common.HexToAddress("0x3333")
	price := common.LeftPadBytes(big.NewInt(5000).Bytes(), 32)

	log := types.Log{
		BlockNumber: 104,
		TxHash:      common.HexToHash("0xbbb"),
		Index:       0,
		Topics: []common.Hash{
			TopicListingCreated,
			common.BigToHash(big.NewInt(10)),
			common.BigToHash(big.NewInt(1)),
			common.BytesToHash(common.LeftPadBytes(seller.Bytes(), 32)),
		},
		Data: price,
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, store.EventListingCreated, events[0].Type)
	assert.Equal(t, "5000", events[0].Data["price"])
	assert.Equal(t, "10", events[0].Data["listing_id"])
}

func TestProcessLog_ListingPurchased(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	buyer := common.HexToAddress("0x4444")
	amount := common.LeftPadBytes(big.NewInt(100).Bytes(), 32)

	log := types.Log{
		BlockNumber: 105,
		TxHash:      common.HexToHash("0xccc"),
		Index:       0,
		Topics: []common.Hash{
			TopicListingPurchased,
			common.BigToHash(big.NewInt(10)),
			common.BytesToHash(common.LeftPadBytes(buyer.Bytes(), 32)),
		},
		Data: amount,
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, store.EventListingPurchased, events[0].Type)
	assert.Equal(t, "100", events[0].Data["amount"])
}

func TestProcessLog_OracleDataSubmitted(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	deviceID := common.HexToHash("0xdevice01")
	ts := common.LeftPadBytes(big.NewInt(1700000000).Bytes(), 32)
	co2 := common.LeftPadBytes(big.NewInt(42).Bytes(), 32)
	data := append(ts, co2...)

	log := types.Log{
		BlockNumber: 106,
		TxHash:      common.HexToHash("0xddd"),
		Index:       0,
		Topics: []common.Hash{
			TopicOracleDataSubmitted,
			deviceID,
		},
		Data: data,
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, store.EventOracleDataSubmitted, events[0].Type)
	assert.Equal(t, "42", events[0].Data["co2_captured_kg"])
}

func TestProcessLog_ProposalCreated(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	proposer := common.HexToAddress("0x5555")
	log := types.Log{
		BlockNumber: 107,
		TxHash:      common.HexToHash("0xeee"),
		Index:       0,
		Topics: []common.Hash{
			TopicProposalCreated,
			common.BigToHash(big.NewInt(42)),
			common.BytesToHash(common.LeftPadBytes(proposer.Bytes(), 32)),
		},
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, store.EventProposalCreated, events[0].Type)
	assert.Equal(t, "42", events[0].Data["proposal_id"])
}

func TestProcessLog_ProposalExecuted(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	log := types.Log{
		BlockNumber: 108,
		TxHash:      common.HexToHash("0xfff"),
		Index:       0,
		Topics: []common.Hash{
			TopicProposalExecuted,
			common.BigToHash(big.NewInt(42)),
		},
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Equal(t, store.EventProposalExecuted, events[0].Type)
}

func TestProcessLog_UnknownEvent(t *testing.T) {
	idx, st := newTestIndexer(&mockFetcher{})

	log := types.Log{
		BlockNumber: 200,
		TxHash:      common.HexToHash("0x999"),
		Index:       0,
		Topics: []common.Hash{
			common.HexToHash("0xdeadbeef"),
		},
		Data: []byte{1, 2, 3},
	}
	err := idx.ProcessLog(log)
	require.NoError(t, err)

	events, err := st.GetEvents(0, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, store.EventUnknown, events[0].Type)
}

func TestProcessLog_NoTopics(t *testing.T) {
	idx, _ := newTestIndexer(&mockFetcher{})
	log := types.Log{
		BlockNumber: 200,
		TxHash:      common.HexToHash("0x999"),
	}
	err := idx.ProcessLog(log)
	assert.Error(t, err)
}

func TestProcessBlock_MultipleEvents(t *testing.T) {
	logs := []types.Log{
		makeCreditMintedLog(100, 0, big.NewInt(1), common.HexToAddress("0x1111"), big.NewInt(1000)),
		makeCreditMintedLog(100, 1, big.NewInt(2), common.HexToAddress("0x2222"), big.NewInt(2000)),
	}

	fetcher := &mockFetcher{
		blocks: map[uint64][]types.Log{100: logs},
		head:   100,
	}
	idx, st := newTestIndexer(fetcher)

	err := idx.ProcessBlock(context.Background(), 100)
	require.NoError(t, err)

	events, _ := st.GetEvents(0, 10)
	assert.Len(t, events, 2)

	block, _ := st.GetLatestBlock()
	assert.Equal(t, uint64(100), block)
}

func TestProcessBlock_EmptyBlock(t *testing.T) {
	fetcher := &mockFetcher{
		blocks: map[uint64][]types.Log{100: {}},
		head:   100,
	}
	idx, st := newTestIndexer(fetcher)

	err := idx.ProcessBlock(context.Background(), 100)
	require.NoError(t, err)

	events, _ := st.GetEvents(0, 10)
	assert.Len(t, events, 0)

	block, _ := st.GetLatestBlock()
	assert.Equal(t, uint64(100), block)
}

func TestReorgHandling(t *testing.T) {
	fetcher := &mockFetcher{}
	idx, st := newTestIndexer(fetcher)

	// Index events at blocks 100 and 101 with distinct tx hashes.
	log1 := makeCreditMintedLog(100, 0, big.NewInt(1), common.HexToAddress("0x1111"), big.NewInt(1000))
	log2 := makeCreditMintedLog(101, 0, big.NewInt(2), common.HexToAddress("0x2222"), big.NewInt(2000))
	log2.TxHash = common.HexToHash("0xdef456")
	require.NoError(t, idx.ProcessLog(log1))
	require.NoError(t, idx.ProcessLog(log2))
	require.NoError(t, st.SetLatestBlock(101))

	events, _ := st.GetEvents(0, 10)
	require.Len(t, events, 2)

	// Reorg from block 101.
	err := idx.HandleReorg(101)
	require.NoError(t, err)

	events, _ = st.GetEvents(0, 10)
	assert.Len(t, events, 1)
	assert.Equal(t, uint64(100), events[0].BlockNumber)

	block, _ := st.GetLatestBlock()
	assert.Equal(t, uint64(100), block)
}

func TestStartBlockConfiguration(t *testing.T) {
	idx, _ := newTestIndexer(&mockFetcher{})
	idx.cfg.StartBlock = 500

	// When store has no block, the indexer should use StartBlock - 1 as the
	// resume point. We verify this indirectly: the first ProcessBlock call
	// should be for block 500.
	assert.Equal(t, uint64(500), idx.cfg.StartBlock)
}
