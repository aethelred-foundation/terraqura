package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/store"
)

func setupTestRouter() (*gin.Engine, *store.InMemoryStore) {
	gin.SetMode(gin.TestMode)
	st := store.NewInMemoryStore()
	logger := zap.NewNop()
	srv := NewServer(st, 8080, logger)
	return srv.Router(), st
}

func seedStore(t *testing.T, st *store.InMemoryStore) {
	t.Helper()
	events := []store.Event{
		{
			ID:          "e1",
			Type:        store.EventCreditMinted,
			BlockNumber: 100,
			TxHash:      "0xaaa",
			CreditID:    "1",
			Addresses:   []string{"0x1111"},
			Data:        map[string]string{"amount": "1000", "owner": "0x1111"},
			Timestamp:   time.Now(),
		},
		{
			ID:          "e2",
			Type:        store.EventCreditRetired,
			BlockNumber: 101,
			TxHash:      "0xbbb",
			CreditID:    "1",
			Addresses:   []string{"0x1111"},
			Data:        map[string]string{"amount": "500", "retiree": "0x1111"},
			Timestamp:   time.Now(),
		},
		{
			ID:          "e3",
			Type:        store.EventCreditMinted,
			BlockNumber: 102,
			TxHash:      "0xccc",
			CreditID:    "2",
			Addresses:   []string{"0x2222"},
			Data:        map[string]string{"amount": "2000", "owner": "0x2222"},
			Timestamp:   time.Now(),
		},
		{
			ID:          "e4",
			Type:        store.EventCreditTransferred,
			BlockNumber: 103,
			TxHash:      "0xddd",
			CreditID:    "2",
			Addresses:   []string{"0x2222", "0x3333"},
			Data:        map[string]string{"amount": "500", "from": "0x2222", "to": "0x3333"},
			Timestamp:   time.Now(),
		},
	}
	for _, ev := range events {
		require.NoError(t, st.SaveEvent(ev))
	}
	require.NoError(t, st.SetLatestBlock(103))
}

func TestHealthEndpoint(t *testing.T) {
	router, _ := setupTestRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ok", resp["status"])
}

func TestGetEvents_All(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	events := resp["events"].([]interface{})
	assert.Len(t, events, 4)
}

func TestGetEvents_Paginated(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events?offset=1&limit=2", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	events := resp["events"].([]interface{})
	assert.Len(t, events, 2)
}

func TestGetEvents_TypeFilter(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events?type=CreditMinted", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	events := resp["events"].([]interface{})
	assert.Len(t, events, 2)
}

func TestGetEvents_CreditIDFilter(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events?credit_id=1", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	events := resp["events"].([]interface{})
	assert.Len(t, events, 2)
}

func TestGetEvents_AddressFilter(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events?address=0x2222", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	events := resp["events"].([]interface{})
	assert.Len(t, events, 2) // e3 and e4 have 0x2222
}

func TestGetEvent_Found(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events/e1", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var ev store.Event
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ev))
	assert.Equal(t, "e1", ev.ID)
}

func TestGetEvent_NotFound(t *testing.T) {
	router, _ := setupTestRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events/nonexistent", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetCreditHistory(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/credits/1/history", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var history store.CreditHistory
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &history))
	assert.Equal(t, "1", history.CreditID)
	assert.Len(t, history.Events, 2)
	assert.Equal(t, "retired", history.Status)
}

func TestGetCreditHistory_Active(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/credits/2/history", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var history store.CreditHistory
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &history))
	assert.Equal(t, "active", history.Status)
	assert.Equal(t, "0x3333", history.CurrentOwner) // transferred to 0x3333
}

func TestGetAddressActivity(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/address/0x1111/activity", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var activity store.AddressActivity
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &activity))
	assert.Equal(t, "0x1111", activity.Address)
	assert.Len(t, activity.EventsInitiated, 2)
}

func TestGetStats(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/stats", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stats map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stats))
	assert.Equal(t, float64(4), stats["total_events"])
	assert.Equal(t, float64(103), stats["last_block"])
}

func TestGetLatestBlock(t *testing.T) {
	router, st := setupTestRouter()
	seedStore(t, st)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/blocks/latest", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(103), resp["latest_block"])
}

func TestGetEvents_ManyPages(t *testing.T) {
	router, st := setupTestRouter()
	for i := 0; i < 100; i++ {
		ev := store.Event{
			ID:          fmt.Sprintf("p%d", i),
			Type:        store.EventCreditMinted,
			BlockNumber: uint64(i),
			TxHash:      fmt.Sprintf("0x%d", i),
			CreditID:    "1",
			Timestamp:   time.Now(),
			Data:        map[string]string{},
		}
		require.NoError(t, st.SaveEvent(ev))
	}

	// Page 1
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/events?offset=0&limit=10", nil)
	router.ServeHTTP(w, req)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp["events"].([]interface{}), 10)

	// Page 10
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/events?offset=90&limit=20", nil)
	router.ServeHTTP(w, req)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp["events"].([]interface{}), 10)
}
