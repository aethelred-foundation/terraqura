package api

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RequestID adds a unique X-Request-ID header to every response.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := uuid.New().String()
		c.Writer.Header().Set("X-Request-ID", id)
		c.Set("request_id", id)
		c.Next()
	}
}

// Logger logs each request using the provided zap logger.
func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		logger.Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("client_ip", c.ClientIP()),
		)
	}
}

// tokenBucket is a simple rate limiter per client IP.
type tokenBucket struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     int           // tokens added per interval
	capacity int           // max tokens
	interval time.Duration // refill interval
}

type bucket struct {
	tokens   int
	lastFill time.Time
}

func newTokenBucket(rate, capacity int, interval time.Duration) *tokenBucket {
	return &tokenBucket{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		capacity: capacity,
		interval: interval,
	}
}

func (tb *tokenBucket) allow(key string) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	b, ok := tb.buckets[key]
	if !ok {
		b = &bucket{tokens: tb.capacity, lastFill: time.Now()}
		tb.buckets[key] = b
	}

	// Refill tokens.
	now := time.Now()
	elapsed := now.Sub(b.lastFill)
	refill := int(elapsed / tb.interval) * tb.rate
	if refill > 0 {
		b.tokens += refill
		if b.tokens > tb.capacity {
			b.tokens = tb.capacity
		}
		b.lastFill = now
	}

	if b.tokens <= 0 {
		return false
	}
	b.tokens--
	return true
}

// RateLimit returns a Gin middleware that enforces a per-IP token bucket rate
// limit. requestsPerSecond controls how many requests each IP may make.
func RateLimit(requestsPerSecond int) gin.HandlerFunc {
	tb := newTokenBucket(requestsPerSecond, requestsPerSecond*2, time.Second)
	return func(c *gin.Context) {
		if !tb.allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}

// CORS adds permissive cross-origin headers for the API.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
