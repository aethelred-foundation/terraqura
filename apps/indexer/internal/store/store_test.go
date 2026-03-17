package store

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeEvent(id string, eventType EventType, block uint64, creditID string, addrs []string) Event {
	return Event{
		ID:          id,
		Type:        eventType,
		BlockNumber: block,
		TxHash:      "0x" + id,
		LogIndex:    0,
		Timestamp:   time.Now(),
		CreditID:    creditID,
		Addresses:   addrs,
		Data:        map[string]string{"key": "value"},
	}
}

func TestSaveAndGetEvents(t *testing.T) {
	s := NewInMemoryStore()

	ev := makeEvent("e1", EventCreditMinted, 100, "1", []string{"0xAAA"})
	require.NoError(t, s.SaveEvent(ev))

	events, err := s.GetEvents(0, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, "e1", events[0].ID)
}

func TestSaveEvent_DuplicateID(t *testing.T) {
	s := NewInMemoryStore()

	ev := makeEvent("e1", EventCreditMinted, 100, "1", nil)
	require.NoError(t, s.SaveEvent(ev))

	err := s.SaveEvent(ev)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestGetEventByID(t *testing.T) {
	s := NewInMemoryStore()
	ev := makeEvent("e1", EventCreditMinted, 100, "1", nil)
	require.NoError(t, s.SaveEvent(ev))

	found, err := s.GetEventByID("e1")
	require.NoError(t, err)
	assert.Equal(t, "e1", found.ID)
}

func TestGetEventByID_NotFound(t *testing.T) {
	s := NewInMemoryStore()
	_, err := s.GetEventByID("nonexistent")
	assert.Error(t, err)
}

func TestGetEventsByType(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e2", EventCreditRetired, 101, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e3", EventCreditMinted, 102, "2", nil)))

	events, err := s.GetEventsByType(EventCreditMinted, 0, 10)
	require.NoError(t, err)
	assert.Len(t, events, 2)
	for _, ev := range events {
		assert.Equal(t, EventCreditMinted, ev.Type)
	}
}

func TestGetEventsByType_Empty(t *testing.T) {
	s := NewInMemoryStore()
	events, err := s.GetEventsByType(EventCreditMinted, 0, 10)
	require.NoError(t, err)
	assert.Len(t, events, 0)
}

func TestGetEventsByCredit(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e2", EventCreditRetired, 101, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e3", EventCreditMinted, 102, "2", nil)))

	events, err := s.GetEventsByCredit("1")
	require.NoError(t, err)
	assert.Len(t, events, 2)

	// Should be ordered by block number.
	assert.True(t, events[0].BlockNumber <= events[1].BlockNumber)
}

func TestGetEventsByCredit_NotFound(t *testing.T) {
	s := NewInMemoryStore()
	events, err := s.GetEventsByCredit("999")
	require.NoError(t, err)
	assert.Len(t, events, 0)
}

func TestGetEventsByAddress(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", []string{"0xAAA"})))
	require.NoError(t, s.SaveEvent(makeEvent("e2", EventCreditRetired, 101, "1", []string{"0xBBB"})))
	require.NoError(t, s.SaveEvent(makeEvent("e3", EventCreditMinted, 102, "2", []string{"0xAAA"})))

	events, err := s.GetEventsByAddress("0xAAA")
	require.NoError(t, err)
	assert.Len(t, events, 2)
}

func TestPagination_Offset(t *testing.T) {
	s := NewInMemoryStore()
	for i := 0; i < 20; i++ {
		require.NoError(t, s.SaveEvent(makeEvent(fmt.Sprintf("e%d", i), EventCreditMinted, uint64(100+i), "1", nil)))
	}

	events, err := s.GetEvents(10, 5)
	require.NoError(t, err)
	assert.Len(t, events, 5)
	assert.Equal(t, "e10", events[0].ID)
}

func TestPagination_OffsetBeyondEnd(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", nil)))

	events, err := s.GetEvents(100, 10)
	require.NoError(t, err)
	assert.Len(t, events, 0)
}

func TestPagination_DefaultLimit(t *testing.T) {
	s := NewInMemoryStore()
	for i := 0; i < 100; i++ {
		require.NoError(t, s.SaveEvent(makeEvent(fmt.Sprintf("e%d", i), EventCreditMinted, uint64(i), "1", nil)))
	}

	events, err := s.GetEvents(0, 0) // limit=0 should default to 50
	require.NoError(t, err)
	assert.Len(t, events, 50)
}

func TestConcurrentReadWrite(t *testing.T) {
	s := NewInMemoryStore()
	var wg sync.WaitGroup

	// Write 100 events concurrently.
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ev := makeEvent(fmt.Sprintf("concurrent-%d", i), EventCreditMinted, uint64(i), "1", nil)
			_ = s.SaveEvent(ev)
		}(i)
	}

	// Read concurrently.
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = s.GetEvents(0, 10)
			_, _ = s.GetLatestBlock()
			_, _ = s.GetStats(time.Second)
		}()
	}

	wg.Wait()

	events, _ := s.GetEvents(0, 200)
	assert.Len(t, events, 100)
}

func TestGetStats(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e2", EventCreditRetired, 101, "1", nil)))
	require.NoError(t, s.SaveEvent(makeEvent("e3", EventCreditMinted, 102, "2", nil)))
	require.NoError(t, s.SetLatestBlock(102))

	stats, err := s.GetStats(5 * time.Second)
	require.NoError(t, err)
	assert.Equal(t, int64(3), stats.TotalEvents)
	assert.Equal(t, int64(2), stats.EventsByType[EventCreditMinted])
	assert.Equal(t, int64(1), stats.EventsByType[EventCreditRetired])
	assert.Equal(t, uint64(102), stats.LastBlock)
	assert.Equal(t, 5*time.Second, stats.Uptime)
}

func TestSetLatestBlock_GetLatestBlock(t *testing.T) {
	s := NewInMemoryStore()

	block, err := s.GetLatestBlock()
	require.NoError(t, err)
	assert.Equal(t, uint64(0), block)

	require.NoError(t, s.SetLatestBlock(999))
	block, _ = s.GetLatestBlock()
	assert.Equal(t, uint64(999), block)
}

func TestDeleteEventsFromBlock(t *testing.T) {
	s := NewInMemoryStore()
	require.NoError(t, s.SaveEvent(makeEvent("e1", EventCreditMinted, 100, "1", []string{"0xA"})))
	require.NoError(t, s.SaveEvent(makeEvent("e2", EventCreditRetired, 101, "1", []string{"0xB"})))
	require.NoError(t, s.SaveEvent(makeEvent("e3", EventCreditMinted, 102, "2", []string{"0xA"})))
	require.NoError(t, s.SetLatestBlock(102))

	require.NoError(t, s.DeleteEventsFromBlock(101))

	events, _ := s.GetEvents(0, 100)
	assert.Len(t, events, 1)
	assert.Equal(t, uint64(100), events[0].BlockNumber)

	block, _ := s.GetLatestBlock()
	assert.Equal(t, uint64(100), block)

	// Indices should be rebuilt.
	byType, _ := s.GetEventsByType(EventCreditMinted, 0, 10)
	assert.Len(t, byType, 1)

	byAddr, _ := s.GetEventsByAddress("0xB")
	assert.Len(t, byAddr, 0)
}

func TestEmptyStoreQueries(t *testing.T) {
	s := NewInMemoryStore()

	events, err := s.GetEvents(0, 10)
	require.NoError(t, err)
	assert.Empty(t, events)

	events, err = s.GetEventsByType(EventCreditMinted, 0, 10)
	require.NoError(t, err)
	assert.Empty(t, events)

	events, err = s.GetEventsByCredit("1")
	require.NoError(t, err)
	assert.Empty(t, events)

	events, err = s.GetEventsByAddress("0xAAA")
	require.NoError(t, err)
	assert.Empty(t, events)

	_, err = s.GetEventByID("missing")
	assert.Error(t, err)

	stats, err := s.GetStats(0)
	require.NoError(t, err)
	assert.Equal(t, int64(0), stats.TotalEvents)
}
