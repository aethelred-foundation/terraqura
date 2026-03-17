package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/aethelred/terraqura-indexer/internal/store"
)

// Server is the HTTP API server.
type Server struct {
	router    *gin.Engine
	port      int
	logger    *zap.Logger
	store     store.Store
	startTime time.Time
}

// NewServer creates a configured API server.
func NewServer(st store.Store, port int, logger *zap.Logger) *Server {
	gin.SetMode(gin.ReleaseMode)

	s := &Server{
		router:    gin.New(),
		port:      port,
		logger:    logger,
		store:     st,
		startTime: time.Now(),
	}

	s.setupMiddleware()
	s.setupRoutes()
	return s
}

func (s *Server) setupMiddleware() {
	s.router.Use(gin.Recovery())
	s.router.Use(CORS())
	s.router.Use(RequestID())
	s.router.Use(Logger(s.logger))
	s.router.Use(RateLimit(100))
}

func (s *Server) setupRoutes() {
	h := NewHandlers(s.store, s.startTime)

	s.router.GET("/health", h.Health)

	v1 := s.router.Group("/api/v1")
	{
		v1.GET("/events", h.GetEvents)
		v1.GET("/events/:id", h.GetEvent)
		v1.GET("/credits/:id/history", h.GetCreditHistory)
		v1.GET("/address/:address/activity", h.GetAddressActivity)
		v1.GET("/stats", h.GetStats)
		v1.GET("/blocks/latest", h.GetLatestBlock)
	}
}

// Router returns the underlying gin.Engine (useful for testing).
func (s *Server) Router() *gin.Engine {
	return s.router
}

// Start runs the HTTP server and blocks until the context is cancelled.
func (s *Server) Start(ctx context.Context) error {
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", s.port),
		Handler:           s.router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		s.logger.Info("API server starting", zap.Int("port", s.port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		s.logger.Info("API server shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}
