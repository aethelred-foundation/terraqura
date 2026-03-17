package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func setupMiddlewareRouter(middlewares ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	for _, mw := range middlewares {
		r.Use(mw)
	}
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func TestRequestID_IsSet(t *testing.T) {
	r := setupMiddlewareRouter(RequestID())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	reqID := w.Header().Get("X-Request-ID")
	assert.NotEmpty(t, reqID)
	assert.Len(t, reqID, 36) // UUID v4 length
}

func TestRequestID_UniquePerRequest(t *testing.T) {
	r := setupMiddlewareRouter(RequestID())

	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w1, req1)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w2, req2)

	assert.NotEqual(t, w1.Header().Get("X-Request-ID"), w2.Header().Get("X-Request-ID"))
}

func TestLoggerMiddleware_NoPanic(t *testing.T) {
	logger := zap.NewNop()
	r := setupMiddlewareRouter(Logger(logger))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)

	require.NotPanics(t, func() {
		r.ServeHTTP(w, req)
	})
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestLoggerMiddleware_PassesThrough(t *testing.T) {
	logger := zap.NewNop()
	r := setupMiddlewareRouter(Logger(logger))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRateLimit_AllowsUnderLimit(t *testing.T) {
	r := setupMiddlewareRouter(RateLimit(10))

	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "request %d should succeed", i)
	}
}

func TestRateLimit_RejectsOverLimit(t *testing.T) {
	// Very low limit: capacity = 2 (rate=1, capacity=1*2=2).
	r := setupMiddlewareRouter(RateLimit(1))

	rejected := false
	// Send enough requests to exhaust the bucket.
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		r.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			rejected = true
			break
		}
	}
	assert.True(t, rejected, "at least one request should be rate-limited")
}

func TestCORS_Headers(t *testing.T) {
	r := setupMiddlewareRouter(CORS())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
}

func TestCORS_Preflight(t *testing.T) {
	r := setupMiddlewareRouter(CORS())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}
