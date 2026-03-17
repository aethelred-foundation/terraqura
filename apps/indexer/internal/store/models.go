package store

import "time"

// EventType represents the category of a blockchain event.
type EventType string

const (
	EventCreditMinted          EventType = "CreditMinted"
	EventCreditRetired         EventType = "CreditRetired"
	EventCreditTransferred     EventType = "CreditTransferred"
	EventVerificationCompleted EventType = "VerificationCompleted"
	EventListingCreated        EventType = "ListingCreated"
	EventListingPurchased      EventType = "ListingPurchased"
	EventOracleDataSubmitted   EventType = "OracleDataSubmitted"
	EventProposalCreated       EventType = "ProposalCreated"
	EventProposalExecuted      EventType = "ProposalExecuted"
	EventUnknown               EventType = "Unknown"
)

// Event is the canonical representation of a decoded blockchain event.
type Event struct {
	ID          string            `json:"id"`
	Type        EventType         `json:"type"`
	BlockNumber uint64            `json:"block_number"`
	TxHash      string            `json:"tx_hash"`
	LogIndex    uint              `json:"log_index"`
	Timestamp   time.Time         `json:"timestamp"`
	CreditID    string            `json:"credit_id,omitempty"`
	Addresses   []string          `json:"addresses,omitempty"`
	Data        map[string]string `json:"data,omitempty"`
}

// IndexerStats captures operational statistics for the indexer.
type IndexerStats struct {
	TotalEvents   int64            `json:"total_events"`
	EventsByType  map[EventType]int64 `json:"events_by_type"`
	LastBlock     uint64           `json:"last_block"`
	LastBlockTime time.Time        `json:"last_block_time"`
	Uptime        time.Duration    `json:"uptime"`
}

// CreditHistory tracks the full lifecycle of a carbon credit.
type CreditHistory struct {
	CreditID     string   `json:"credit_id"`
	Events       []Event  `json:"events"`
	CurrentOwner string   `json:"current_owner"`
	Status       string   `json:"status"`
}

// AddressActivity summarises an address's interactions with the platform.
type AddressActivity struct {
	Address         string   `json:"address"`
	EventsInitiated []Event  `json:"events_initiated"`
	CreditsOwned    []string `json:"credits_owned"`
	CreditsRetired  []string `json:"credits_retired"`
}
