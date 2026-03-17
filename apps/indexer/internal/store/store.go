package store

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// Store is the persistence interface for indexed blockchain events.
type Store interface {
	SaveEvent(event Event) error
	GetEvents(offset, limit int) ([]Event, error)
	GetEventByID(id string) (*Event, error)
	GetEventsByType(eventType EventType, offset, limit int) ([]Event, error)
	GetEventsByCredit(creditID string) ([]Event, error)
	GetEventsByAddress(address string) ([]Event, error)
	GetLatestBlock() (uint64, error)
	SetLatestBlock(block uint64) error
	GetStats(uptime time.Duration) (*IndexerStats, error)
	DeleteEventsFromBlock(blockNum uint64) error
}

// InMemoryStore is a thread-safe, in-memory implementation of Store.
type InMemoryStore struct {
	mu          sync.RWMutex
	events      []Event
	byID        map[string]*Event
	byType      map[EventType][]int // indices into events slice
	byCredit    map[string][]int
	byAddress   map[string][]int
	byBlock     map[uint64][]int
	latestBlock uint64
}

// NewInMemoryStore creates an initialised InMemoryStore.
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		events:    make([]Event, 0),
		byID:      make(map[string]*Event),
		byType:    make(map[EventType][]int),
		byCredit:  make(map[string][]int),
		byAddress: make(map[string][]int),
		byBlock:   make(map[uint64][]int),
	}
}

func (s *InMemoryStore) SaveEvent(event Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.byID[event.ID]; exists {
		return fmt.Errorf("event %s already exists", event.ID)
	}

	idx := len(s.events)
	s.events = append(s.events, event)
	s.byID[event.ID] = &s.events[idx]

	s.byType[event.Type] = append(s.byType[event.Type], idx)

	if event.CreditID != "" {
		s.byCredit[event.CreditID] = append(s.byCredit[event.CreditID], idx)
	}

	for _, addr := range event.Addresses {
		s.byAddress[addr] = append(s.byAddress[addr], idx)
	}

	s.byBlock[event.BlockNumber] = append(s.byBlock[event.BlockNumber], idx)

	return nil
}

func (s *InMemoryStore) GetEvents(offset, limit int) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 50
	}

	if offset >= len(s.events) {
		return []Event{}, nil
	}

	end := offset + limit
	if end > len(s.events) {
		end = len(s.events)
	}

	result := make([]Event, end-offset)
	copy(result, s.events[offset:end])
	return result, nil
}

func (s *InMemoryStore) GetEventByID(id string) (*Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ev, ok := s.byID[id]
	if !ok {
		return nil, fmt.Errorf("event %s not found", id)
	}
	copied := *ev
	return &copied, nil
}

func (s *InMemoryStore) GetEventsByType(eventType EventType, offset, limit int) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	indices := s.byType[eventType]
	return s.paginateIndices(indices, offset, limit), nil
}

func (s *InMemoryStore) GetEventsByCredit(creditID string) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	indices := s.byCredit[creditID]
	result := make([]Event, 0, len(indices))
	for _, idx := range indices {
		result = append(result, s.events[idx])
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].BlockNumber < result[j].BlockNumber
	})

	return result, nil
}

func (s *InMemoryStore) GetEventsByAddress(address string) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	indices := s.byAddress[address]
	result := make([]Event, 0, len(indices))
	for _, idx := range indices {
		result = append(result, s.events[idx])
	}
	return result, nil
}

func (s *InMemoryStore) GetLatestBlock() (uint64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.latestBlock, nil
}

func (s *InMemoryStore) SetLatestBlock(block uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.latestBlock = block
	return nil
}

func (s *InMemoryStore) GetStats(uptime time.Duration) (*IndexerStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	byType := make(map[EventType]int64)
	for t, indices := range s.byType {
		byType[t] = int64(len(indices))
	}

	stats := &IndexerStats{
		TotalEvents:  int64(len(s.events)),
		EventsByType: byType,
		LastBlock:    s.latestBlock,
		Uptime:       uptime,
	}

	if len(s.events) > 0 {
		stats.LastBlockTime = s.events[len(s.events)-1].Timestamp
	}

	return stats, nil
}

// DeleteEventsFromBlock removes all events at or above the given block number.
// Used during chain reorg handling.
func (s *InMemoryStore) DeleteEventsFromBlock(blockNum uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find the cut point.
	cutIdx := len(s.events)
	for i, ev := range s.events {
		if ev.BlockNumber >= blockNum {
			cutIdx = i
			break
		}
	}

	// Remove from ID index.
	for i := cutIdx; i < len(s.events); i++ {
		delete(s.byID, s.events[i].ID)
	}

	s.events = s.events[:cutIdx]

	// Rebuild secondary indices from scratch (simple but correct).
	s.byType = make(map[EventType][]int)
	s.byCredit = make(map[string][]int)
	s.byAddress = make(map[string][]int)
	s.byBlock = make(map[uint64][]int)

	for idx, ev := range s.events {
		s.byType[ev.Type] = append(s.byType[ev.Type], idx)
		if ev.CreditID != "" {
			s.byCredit[ev.CreditID] = append(s.byCredit[ev.CreditID], idx)
		}
		for _, addr := range ev.Addresses {
			s.byAddress[addr] = append(s.byAddress[addr], idx)
		}
		s.byBlock[ev.BlockNumber] = append(s.byBlock[ev.BlockNumber], idx)
	}

	if blockNum > 0 {
		s.latestBlock = blockNum - 1
	} else {
		s.latestBlock = 0
	}

	return nil
}

func (s *InMemoryStore) paginateIndices(indices []int, offset, limit int) []Event {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 50
	}

	if offset >= len(indices) {
		return []Event{}
	}

	end := offset + limit
	if end > len(indices) {
		end = len(indices)
	}

	result := make([]Event, 0, end-offset)
	for _, idx := range indices[offset:end] {
		result = append(result, s.events[idx])
	}
	return result
}
