package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/aethelred/terraqura-indexer/internal/store"
)

// Handlers holds dependencies for API route handlers.
type Handlers struct {
	store     store.Store
	startTime time.Time
}

// NewHandlers creates a Handlers instance.
func NewHandlers(s store.Store, startTime time.Time) *Handlers {
	return &Handlers{store: s, startTime: startTime}
}

// Health returns service health and basic indexer stats.
func (h *Handlers) Health(c *gin.Context) {
	uptime := time.Since(h.startTime)
	stats, err := h.store.GetStats(uptime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":       "ok",
		"uptime":       uptime.String(),
		"total_events": stats.TotalEvents,
		"last_block":   stats.LastBlock,
	})
}

// GetEvents returns a paginated, filterable list of events.
func (h *Handlers) GetEvents(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if limit <= 0 || limit > 1000 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Filter by type.
	if typeStr := c.Query("type"); typeStr != "" {
		eventType := store.EventType(typeStr)
		events, err := h.store.GetEventsByType(eventType, offset, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query events"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"events": events, "offset": offset, "limit": limit})
		return
	}

	// Filter by credit ID.
	if creditID := c.Query("credit_id"); creditID != "" {
		events, err := h.store.GetEventsByCredit(creditID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query events"})
			return
		}
		// Manual pagination for credit filter.
		total := len(events)
		if offset >= total {
			events = []store.Event{}
		} else {
			end := offset + limit
			if end > total {
				end = total
			}
			events = events[offset:end]
		}
		c.JSON(http.StatusOK, gin.H{"events": events, "offset": offset, "limit": limit})
		return
	}

	// Filter by address.
	if addr := c.Query("address"); addr != "" {
		events, err := h.store.GetEventsByAddress(addr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query events"})
			return
		}
		total := len(events)
		if offset >= total {
			events = []store.Event{}
		} else {
			end := offset + limit
			if end > total {
				end = total
			}
			events = events[offset:end]
		}
		c.JSON(http.StatusOK, gin.H{"events": events, "offset": offset, "limit": limit})
		return
	}

	events, err := h.store.GetEvents(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query events"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events, "offset": offset, "limit": limit})
}

// GetEvent returns a single event by ID.
func (h *Handlers) GetEvent(c *gin.Context) {
	id := c.Param("id")
	ev, err := h.store.GetEventByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}
	c.JSON(http.StatusOK, ev)
}

// GetCreditHistory returns the full event history for a carbon credit.
func (h *Handlers) GetCreditHistory(c *gin.Context) {
	creditID := c.Param("id")
	events, err := h.store.GetEventsByCredit(creditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query credit history"})
		return
	}

	history := store.CreditHistory{
		CreditID: creditID,
		Events:   events,
		Status:   "active",
	}

	// Derive current owner and status from event history.
	for _, ev := range events {
		switch ev.Type {
		case store.EventCreditMinted:
			if owner, ok := ev.Data["owner"]; ok {
				history.CurrentOwner = owner
			}
		case store.EventCreditTransferred:
			if to, ok := ev.Data["to"]; ok {
				history.CurrentOwner = to
			}
		case store.EventCreditRetired:
			history.Status = "retired"
		}
	}

	c.JSON(http.StatusOK, history)
}

// GetAddressActivity returns all activity associated with an address.
func (h *Handlers) GetAddressActivity(c *gin.Context) {
	addr := c.Param("address")
	events, err := h.store.GetEventsByAddress(addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query address activity"})
		return
	}

	activity := store.AddressActivity{
		Address:         addr,
		EventsInitiated: events,
		CreditsOwned:    make([]string, 0),
		CreditsRetired:  make([]string, 0),
	}

	ownedSet := make(map[string]bool)
	retiredSet := make(map[string]bool)

	for _, ev := range events {
		switch ev.Type {
		case store.EventCreditMinted:
			if ev.CreditID != "" {
				ownedSet[ev.CreditID] = true
			}
		case store.EventCreditTransferred:
			if to, ok := ev.Data["to"]; ok && to == addr {
				ownedSet[ev.CreditID] = true
			}
			if from, ok := ev.Data["from"]; ok && from == addr {
				delete(ownedSet, ev.CreditID)
			}
		case store.EventCreditRetired:
			if ev.CreditID != "" {
				retiredSet[ev.CreditID] = true
				delete(ownedSet, ev.CreditID)
			}
		}
	}

	for id := range ownedSet {
		activity.CreditsOwned = append(activity.CreditsOwned, id)
	}
	for id := range retiredSet {
		activity.CreditsRetired = append(activity.CreditsRetired, id)
	}

	c.JSON(http.StatusOK, activity)
}

// GetStats returns indexer statistics.
func (h *Handlers) GetStats(c *gin.Context) {
	uptime := time.Since(h.startTime)
	stats, err := h.store.GetStats(uptime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetLatestBlock returns the latest indexed block number.
func (h *Handlers) GetLatestBlock(c *gin.Context) {
	block, err := h.store.GetLatestBlock()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get latest block"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"latest_block": block})
}
