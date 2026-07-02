package indexer

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/aethelred/terraqura-indexer/internal/store"
)

func TestEventSignatureConstants(t *testing.T) {
	tests := []struct {
		name string
		sig  string
		want common.Hash
	}{
		{"CreditMinted", SigCreditMinted, TopicCreditMinted},
		{"CreditRetired", SigCreditRetired, TopicCreditRetired},
		{"CreditTransferred", SigCreditTransferred, TopicCreditTransferred},
		{"VerificationCompleted", SigVerificationCompleted, TopicVerificationCompleted},
		{"ListingCreated", SigListingCreated, TopicListingCreated},
		{"ListingPurchased", SigListingPurchased, TopicListingPurchased},
		{"OracleDataSubmitted", SigOracleDataSubmitted, TopicOracleDataSubmitted},
		{"ProposalCreated", SigProposalCreated, TopicProposalCreated},
		{"ProposalExecuted", SigProposalExecuted, TopicProposalExecuted},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expected := crypto.Keccak256Hash([]byte(tt.sig))
			assert.Equal(t, expected, tt.want, "topic hash mismatch for %s", tt.name)
		})
	}
}

func TestEventTypeFromTopic_Known(t *testing.T) {
	assert.Equal(t, store.EventCreditMinted, EventTypeFromTopic(TopicCreditMinted))
	assert.Equal(t, store.EventProposalExecuted, EventTypeFromTopic(TopicProposalExecuted))
}

func TestEventTypeFromTopic_Unknown(t *testing.T) {
	unknown := common.HexToHash("0xdeadbeefdeadbeefdeadbeefdeadbeef")
	assert.Equal(t, store.EventUnknown, EventTypeFromTopic(unknown))
}

func TestDecodeEvent_CreditMinted(t *testing.T) {
	owner := common.HexToAddress("0x1111111111111111111111111111111111111111")
	amount := common.LeftPadBytes(big.NewInt(500).Bytes(), 32)
	offset := common.LeftPadBytes(big.NewInt(64).Bytes(), 32)
	strLen := common.LeftPadBytes(big.NewInt(4).Bytes(), 32)
	strData := make([]byte, 32)
	copy(strData, []byte("test"))

	data := append(amount, offset...)
	data = append(data, strLen...)
	data = append(data, strData...)

	log := types.Log{
		BlockNumber: 10,
		TxHash:      common.HexToHash("0xaaa"),
		Index:       0,
		Topics: []common.Hash{
			TopicCreditMinted,
			common.BigToHash(big.NewInt(1)),
			common.BytesToHash(common.LeftPadBytes(owner.Bytes(), 32)),
		},
		Data: data,
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventCreditMinted, ev.Type)
	assert.Equal(t, "1", ev.CreditID)
	assert.Equal(t, "500", ev.Data["amount"])
	assert.Equal(t, "test", ev.Data["methodology"])
}

func TestDecodeEvent_CreditRetired(t *testing.T) {
	retiree := common.HexToAddress("0x2222222222222222222222222222222222222222")
	data := common.LeftPadBytes(big.NewInt(100).Bytes(), 32)

	log := types.Log{
		BlockNumber: 20,
		TxHash:      common.HexToHash("0xbbb"),
		Index:       1,
		Topics: []common.Hash{
			TopicCreditRetired,
			common.BigToHash(big.NewInt(5)),
			common.BytesToHash(common.LeftPadBytes(retiree.Bytes(), 32)),
		},
		Data: data,
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventCreditRetired, ev.Type)
	assert.Equal(t, "5", ev.CreditID)
	assert.Equal(t, "100", ev.Data["amount"])
}

func TestDecodeEvent_CreditTransferred(t *testing.T) {
	from := common.HexToAddress("0x1111")
	to := common.HexToAddress("0x2222")
	data := common.LeftPadBytes(big.NewInt(300).Bytes(), 32)

	log := types.Log{
		BlockNumber: 30,
		TxHash:      common.HexToHash("0xccc"),
		Index:       0,
		Topics: []common.Hash{
			TopicCreditTransferred,
			common.BigToHash(big.NewInt(7)),
			common.BytesToHash(common.LeftPadBytes(from.Bytes(), 32)),
			common.BytesToHash(common.LeftPadBytes(to.Bytes(), 32)),
		},
		Data: data,
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventCreditTransferred, ev.Type)
	assert.Len(t, ev.Addresses, 2)
}

func TestDecodeEvent_ProposalExecuted(t *testing.T) {
	log := types.Log{
		BlockNumber: 50,
		TxHash:      common.HexToHash("0xeee"),
		Index:       0,
		Topics: []common.Hash{
			TopicProposalExecuted,
			common.BigToHash(big.NewInt(99)),
		},
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventProposalExecuted, ev.Type)
	assert.Equal(t, "99", ev.Data["proposal_id"])
}

func TestDecodeEvent_NoTopics(t *testing.T) {
	log := types.Log{
		BlockNumber: 1,
		TxHash:      common.HexToHash("0x111"),
	}
	_, err := DecodeEvent(log)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no topics")
}

func TestDecodeEvent_UnknownTopic(t *testing.T) {
	log := types.Log{
		BlockNumber: 1,
		TxHash:      common.HexToHash("0x222"),
		Index:       0,
		Topics: []common.Hash{
			common.HexToHash("0xdeadbeef"),
		},
		Data: []byte{0x01},
	}
	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventUnknown, ev.Type)
}

func TestDecodeEvent_CreditMinted_InsufficientTopics(t *testing.T) {
	log := types.Log{
		BlockNumber: 1,
		TxHash:      common.HexToHash("0x333"),
		Index:       0,
		Topics: []common.Hash{
			TopicCreditMinted,
			// Missing owner topic
		},
		Data: make([]byte, 64),
	}
	_, err := DecodeEvent(log)
	assert.Error(t, err)
}

func TestDecodeEvent_EventIDFormat(t *testing.T) {
	txHash := common.HexToHash("0xabcdef")
	log := types.Log{
		BlockNumber: 1,
		TxHash:      txHash,
		Index:       5,
		Topics: []common.Hash{
			TopicProposalExecuted,
			common.BigToHash(big.NewInt(1)),
		},
	}
	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, txHash.Hex()+"-5", ev.ID)
}

func TestDecodeEvent_ClaimAnchored(t *testing.T) {
	dacUnit := common.HexToHash("0x1111111111111111111111111111111111111111111111111111111111111111")
	sourceHash := common.HexToHash("0x2222222222222222222222222222222222222222222222222222222222222222")

	// data = head(offset sealId, offset jobId) + sealId(len,payload) + jobId(len,payload)
	offSeal := common.LeftPadBytes(big.NewInt(64).Bytes(), 32)     // 2 head words → 64
	sealID := "abc123"
	jobID := "job-mrv-001"
	sealLen := common.LeftPadBytes(big.NewInt(int64(len(sealID))).Bytes(), 32)
	sealData := common.RightPadBytes([]byte(sealID), 32)
	// jobId offset = 64 (head) + 32 (sealLen) + 32 (sealData word) = 128
	offJob := common.LeftPadBytes(big.NewInt(128).Bytes(), 32)
	jobLen := common.LeftPadBytes(big.NewInt(int64(len(jobID))).Bytes(), 32)
	jobData := common.RightPadBytes([]byte(jobID), 32)

	data := append([]byte{}, offSeal...)
	data = append(data, offJob...)
	data = append(data, sealLen...)
	data = append(data, sealData...)
	data = append(data, jobLen...)
	data = append(data, jobData...)

	log := types.Log{
		BlockNumber: 30,
		TxHash:      common.HexToHash("0xccc"),
		Index:       2,
		Topics:      []common.Hash{TopicClaimAnchored, dacUnit, sourceHash},
		Data:        data,
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventClaimAnchored, ev.Type)
	assert.Equal(t, dacUnit.Hex(), ev.Data["dac_unit_id"])
	assert.Equal(t, sourceHash.Hex(), ev.Data["source_data_hash"])
	assert.Equal(t, sealID, ev.Data["seal_id"])
	assert.Equal(t, jobID, ev.Data["job_id"])
}

func TestDecodeEvent_ClaimAnchored_TooFewTopics(t *testing.T) {
	log := types.Log{
		BlockNumber: 30,
		TxHash:      common.HexToHash("0xccd"),
		Index:       0,
		Topics:      []common.Hash{TopicClaimAnchored, common.BigToHash(big.NewInt(1))},
	}
	_, err := DecodeEvent(log)
	assert.Error(t, err)
}

func TestDecodeEvent_AnchorRevoked(t *testing.T) {
	dacUnit := common.HexToHash("0x1111111111111111111111111111111111111111111111111111111111111111")
	sourceHash := common.HexToHash("0x2222222222222222222222222222222222222222222222222222222222222222")
	by := common.HexToAddress("0x3333333333333333333333333333333333333333")

	log := types.Log{
		BlockNumber: 31,
		TxHash:      common.HexToHash("0xcce"),
		Index:       0,
		Topics: []common.Hash{
			TopicAnchorRevoked,
			dacUnit,
			sourceHash,
			common.BytesToHash(common.LeftPadBytes(by.Bytes(), 32)),
		},
	}

	ev, err := DecodeEvent(log)
	require.NoError(t, err)
	assert.Equal(t, store.EventAnchorRevoked, ev.Type)
	assert.Equal(t, dacUnit.Hex(), ev.Data["dac_unit_id"])
	assert.Equal(t, sourceHash.Hex(), ev.Data["source_data_hash"])
	assert.Equal(t, by.Hex(), ev.Data["by"])
	assert.Contains(t, ev.Addresses, by.Hex())
}

func TestDecodeEvent_AnchorRevoked_TooFewTopics(t *testing.T) {
	log := types.Log{
		BlockNumber: 31,
		TxHash:      common.HexToHash("0xccf"),
		Index:       0,
		Topics:      []common.Hash{TopicAnchorRevoked, common.BigToHash(big.NewInt(1))},
	}
	_, err := DecodeEvent(log)
	assert.Error(t, err)
}

func TestEventSignatureConstants_SealTier(t *testing.T) {
	assert.Equal(t, crypto.Keccak256Hash([]byte(SigClaimAnchored)), TopicClaimAnchored)
	assert.Equal(t, crypto.Keccak256Hash([]byte(SigAnchorRevoked)), TopicAnchorRevoked)
	assert.Equal(t, store.EventClaimAnchored, EventTypeFromTopic(TopicClaimAnchored))
	assert.Equal(t, store.EventAnchorRevoked, EventTypeFromTopic(TopicAnchorRevoked))
}
