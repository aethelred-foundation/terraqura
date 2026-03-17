package indexer

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/aethelred/terraqura-indexer/internal/store"
)

// Event signature strings matching the Solidity contracts.
const (
	SigCreditMinted          = "CreditMinted(uint256,address,uint256,string)"
	SigCreditRetired         = "CreditRetired(uint256,address,uint256)"
	SigCreditTransferred     = "CreditTransferred(uint256,address,address,uint256)"
	SigVerificationCompleted = "VerificationCompleted(uint256,uint8,uint256)"
	SigListingCreated        = "ListingCreated(uint256,uint256,address,uint256)"
	SigListingPurchased      = "ListingPurchased(uint256,address,uint256)"
	SigOracleDataSubmitted   = "OracleDataSubmitted(bytes32,uint256,uint256)"
	SigProposalCreated       = "ProposalCreated(uint256,address)"
	SigProposalExecuted      = "ProposalExecuted(uint256)"
)

// Pre-computed keccak256 topic hashes.
var (
	TopicCreditMinted          = EventSignatureHash(SigCreditMinted)
	TopicCreditRetired         = EventSignatureHash(SigCreditRetired)
	TopicCreditTransferred     = EventSignatureHash(SigCreditTransferred)
	TopicVerificationCompleted = EventSignatureHash(SigVerificationCompleted)
	TopicListingCreated        = EventSignatureHash(SigListingCreated)
	TopicListingPurchased      = EventSignatureHash(SigListingPurchased)
	TopicOracleDataSubmitted   = EventSignatureHash(SigOracleDataSubmitted)
	TopicProposalCreated       = EventSignatureHash(SigProposalCreated)
	TopicProposalExecuted      = EventSignatureHash(SigProposalExecuted)
)

// topicToType maps topic0 hashes to their EventType.
var topicToType = map[common.Hash]store.EventType{
	TopicCreditMinted:          store.EventCreditMinted,
	TopicCreditRetired:         store.EventCreditRetired,
	TopicCreditTransferred:     store.EventCreditTransferred,
	TopicVerificationCompleted: store.EventVerificationCompleted,
	TopicListingCreated:        store.EventListingCreated,
	TopicListingPurchased:      store.EventListingPurchased,
	TopicOracleDataSubmitted:   store.EventOracleDataSubmitted,
	TopicProposalCreated:       store.EventProposalCreated,
	TopicProposalExecuted:      store.EventProposalExecuted,
}

// EventTypeFromTopic returns the EventType for a given topic0 hash.
func EventTypeFromTopic(topic common.Hash) store.EventType {
	if t, ok := topicToType[topic]; ok {
		return t
	}
	return store.EventUnknown
}

// DecodeEvent transforms a raw Ethereum log into a typed store.Event.
// Returns an error only for malformed data; unknown topics produce an
// event with type EventUnknown.
func DecodeEvent(log types.Log) (store.Event, error) {
	if len(log.Topics) == 0 {
		return store.Event{}, fmt.Errorf("log has no topics")
	}

	eventType := EventTypeFromTopic(log.Topics[0])

	ev := store.Event{
		ID:          fmt.Sprintf("%s-%d", log.TxHash.Hex(), log.Index),
		Type:        eventType,
		BlockNumber: log.BlockNumber,
		TxHash:      log.TxHash.Hex(),
		LogIndex:    log.Index,
		Data:        make(map[string]string),
		Addresses:   make([]string, 0),
	}

	switch eventType {
	case store.EventCreditMinted:
		if err := decodeCreditMinted(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding CreditMinted: %w", err)
		}
	case store.EventCreditRetired:
		if err := decodeCreditRetired(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding CreditRetired: %w", err)
		}
	case store.EventCreditTransferred:
		if err := decodeCreditTransferred(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding CreditTransferred: %w", err)
		}
	case store.EventVerificationCompleted:
		if err := decodeVerificationCompleted(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding VerificationCompleted: %w", err)
		}
	case store.EventListingCreated:
		if err := decodeListingCreated(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding ListingCreated: %w", err)
		}
	case store.EventListingPurchased:
		if err := decodeListingPurchased(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding ListingPurchased: %w", err)
		}
	case store.EventOracleDataSubmitted:
		if err := decodeOracleDataSubmitted(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding OracleDataSubmitted: %w", err)
		}
	case store.EventProposalCreated:
		if err := decodeProposalCreated(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding ProposalCreated: %w", err)
		}
	case store.EventProposalExecuted:
		if err := decodeProposalExecuted(log, &ev); err != nil {
			return ev, fmt.Errorf("decoding ProposalExecuted: %w", err)
		}
	case store.EventUnknown:
		ev.Data["raw_topics"] = fmt.Sprintf("%v", log.Topics)
	}

	return ev, nil
}

// CreditMinted(uint256 indexed creditId, address indexed owner, uint256 amount, string methodology)
func decodeCreditMinted(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 3 {
		return fmt.Errorf("expected 3 topics, got %d", len(log.Topics))
	}

	creditID := log.Topics[1].Big()
	owner := DecodeAddress(log.Topics[2])

	ev.CreditID = Uint256ToString(creditID)
	ev.Addresses = append(ev.Addresses, owner.Hex())

	amount, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding amount: %w", err)
	}
	ev.Data["amount"] = Uint256ToString(amount)

	methodology, err := DecodeDynamicString(log.Data, 1)
	if err != nil {
		// Non-fatal: store raw data instead.
		ev.Data["methodology"] = fmt.Sprintf("0x%x", log.Data)
	} else {
		ev.Data["methodology"] = methodology
	}
	ev.Data["owner"] = owner.Hex()

	return nil
}

// CreditRetired(uint256 indexed creditId, address indexed retiree, uint256 amount)
func decodeCreditRetired(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 3 {
		return fmt.Errorf("expected 3 topics, got %d", len(log.Topics))
	}

	creditID := log.Topics[1].Big()
	retiree := DecodeAddress(log.Topics[2])

	ev.CreditID = Uint256ToString(creditID)
	ev.Addresses = append(ev.Addresses, retiree.Hex())

	amount, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding amount: %w", err)
	}
	ev.Data["amount"] = Uint256ToString(amount)
	ev.Data["retiree"] = retiree.Hex()

	return nil
}

// CreditTransferred(uint256 indexed creditId, address indexed from, address indexed to, uint256 amount)
func decodeCreditTransferred(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 4 {
		return fmt.Errorf("expected 4 topics, got %d", len(log.Topics))
	}

	creditID := log.Topics[1].Big()
	from := DecodeAddress(log.Topics[2])
	to := DecodeAddress(log.Topics[3])

	ev.CreditID = Uint256ToString(creditID)
	ev.Addresses = append(ev.Addresses, from.Hex(), to.Hex())

	amount, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding amount: %w", err)
	}
	ev.Data["amount"] = Uint256ToString(amount)
	ev.Data["from"] = from.Hex()
	ev.Data["to"] = to.Hex()

	return nil
}

// VerificationCompleted(uint256 indexed creditId, uint8 status, uint256 score)
func decodeVerificationCompleted(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 2 {
		return fmt.Errorf("expected 2 topics, got %d", len(log.Topics))
	}

	creditID := log.Topics[1].Big()
	ev.CreditID = Uint256ToString(creditID)

	status, err := DecodeUint8(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding status: %w", err)
	}
	score, err := DecodeUint256(log.Data, 1)
	if err != nil {
		return fmt.Errorf("decoding score: %w", err)
	}

	ev.Data["status"] = fmt.Sprintf("%d", status)
	ev.Data["score"] = Uint256ToString(score)

	return nil
}

// ListingCreated(uint256 indexed listingId, uint256 indexed creditId, address indexed seller, uint256 price)
func decodeListingCreated(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 4 {
		return fmt.Errorf("expected 4 topics, got %d", len(log.Topics))
	}

	listingID := log.Topics[1].Big()
	creditID := log.Topics[2].Big()
	seller := DecodeAddress(log.Topics[3])

	ev.CreditID = Uint256ToString(creditID)
	ev.Addresses = append(ev.Addresses, seller.Hex())

	price, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding price: %w", err)
	}

	ev.Data["listing_id"] = Uint256ToString(listingID)
	ev.Data["seller"] = seller.Hex()
	ev.Data["price"] = Uint256ToString(price)

	return nil
}

// ListingPurchased(uint256 indexed listingId, address indexed buyer, uint256 amount)
func decodeListingPurchased(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 3 {
		return fmt.Errorf("expected 3 topics, got %d", len(log.Topics))
	}

	listingID := log.Topics[1].Big()
	buyer := DecodeAddress(log.Topics[2])

	ev.Addresses = append(ev.Addresses, buyer.Hex())

	amount, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding amount: %w", err)
	}

	ev.Data["listing_id"] = Uint256ToString(listingID)
	ev.Data["buyer"] = buyer.Hex()
	ev.Data["amount"] = Uint256ToString(amount)

	return nil
}

// OracleDataSubmitted(bytes32 indexed deviceId, uint256 timestamp, uint256 co2CapturedKg)
func decodeOracleDataSubmitted(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 2 {
		return fmt.Errorf("expected 2 topics, got %d", len(log.Topics))
	}

	deviceID := DecodeBytes32(log.Topics[1])
	ev.Data["device_id"] = deviceID

	ts, err := DecodeUint256(log.Data, 0)
	if err != nil {
		return fmt.Errorf("decoding timestamp: %w", err)
	}
	co2, err := DecodeUint256(log.Data, 1)
	if err != nil {
		return fmt.Errorf("decoding co2_captured_kg: %w", err)
	}

	ev.Data["timestamp"] = Uint256ToString(ts)
	ev.Data["co2_captured_kg"] = Uint256ToString(co2)

	return nil
}

// ProposalCreated(uint256 indexed proposalId, address indexed proposer)
func decodeProposalCreated(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 3 {
		return fmt.Errorf("expected 3 topics, got %d", len(log.Topics))
	}

	proposalID := log.Topics[1].Big()
	proposer := DecodeAddress(log.Topics[2])

	ev.Addresses = append(ev.Addresses, proposer.Hex())
	ev.Data["proposal_id"] = Uint256ToString(proposalID)
	ev.Data["proposer"] = proposer.Hex()

	return nil
}

// ProposalExecuted(uint256 indexed proposalId)
func decodeProposalExecuted(log types.Log, ev *store.Event) error {
	if len(log.Topics) < 2 {
		return fmt.Errorf("expected 2 topics, got %d", len(log.Topics))
	}

	proposalID := log.Topics[1].Big()
	ev.Data["proposal_id"] = Uint256ToString(proposalID)

	return nil
}
