package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const storeOpTimeout = 5 * time.Second

// PostgresStore is a durable implementation of Store for production indexers.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	st := &PostgresStore{pool: pool}
	if err := st.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return st, nil
}

func (s *PostgresStore) Close() {
	s.pool.Close()
}

func (s *PostgresStore) migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS indexer_events (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			block_number BIGINT NOT NULL,
			tx_hash TEXT NOT NULL,
			log_index BIGINT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL,
			credit_id TEXT NOT NULL DEFAULT '',
			addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
			data JSONB NOT NULL DEFAULT '{}'::jsonb
		);

		CREATE INDEX IF NOT EXISTS idx_indexer_events_type
			ON indexer_events(type, block_number, log_index);
		CREATE INDEX IF NOT EXISTS idx_indexer_events_credit
			ON indexer_events(credit_id, block_number, log_index);
		CREATE INDEX IF NOT EXISTS idx_indexer_events_block
			ON indexer_events(block_number, log_index);
		CREATE INDEX IF NOT EXISTS idx_indexer_events_addresses
			ON indexer_events USING GIN(addresses);

		CREATE TABLE IF NOT EXISTS indexer_state (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`)
	return err
}

func (s *PostgresStore) SaveEvent(event Event) error {
	ctx, cancel := opContext()
	defer cancel()

	addresses, err := json.Marshal(event.Addresses)
	if err != nil {
		return fmt.Errorf("encoding addresses: %w", err)
	}
	data, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("encoding data: %w", err)
	}

	tag, err := s.pool.Exec(ctx, `
		INSERT INTO indexer_events (
			id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
		ON CONFLICT (id) DO NOTHING
	`,
		event.ID,
		string(event.Type),
		event.BlockNumber,
		event.TxHash,
		int64(event.LogIndex),
		event.Timestamp,
		event.CreditID,
		string(addresses),
		string(data),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("event %s already exists", event.ID)
	}
	return nil
}

func (s *PostgresStore) GetEvents(offset, limit int) ([]Event, error) {
	offset, limit = normalizePagination(offset, limit)
	return s.queryEvents(`
		SELECT id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		FROM indexer_events
		ORDER BY block_number ASC, log_index ASC, id ASC
		OFFSET $1 LIMIT $2
	`, offset, limit)
}

func (s *PostgresStore) GetEventByID(id string) (*Event, error) {
	events, err := s.queryEvents(`
		SELECT id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		FROM indexer_events
		WHERE id = $1
		LIMIT 1
	`, id)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, fmt.Errorf("event %s not found", id)
	}
	return &events[0], nil
}

func (s *PostgresStore) GetEventsByType(eventType EventType, offset, limit int) ([]Event, error) {
	offset, limit = normalizePagination(offset, limit)
	return s.queryEvents(`
		SELECT id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		FROM indexer_events
		WHERE type = $1
		ORDER BY block_number ASC, log_index ASC, id ASC
		OFFSET $2 LIMIT $3
	`, string(eventType), offset, limit)
}

func (s *PostgresStore) GetEventsByCredit(creditID string) ([]Event, error) {
	return s.queryEvents(`
		SELECT id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		FROM indexer_events
		WHERE credit_id = $1
		ORDER BY block_number ASC, log_index ASC, id ASC
	`, creditID)
}

func (s *PostgresStore) GetEventsByAddress(address string) ([]Event, error) {
	addressJSON, err := json.Marshal([]string{address})
	if err != nil {
		return nil, fmt.Errorf("encoding address filter: %w", err)
	}
	return s.queryEvents(`
		SELECT id, type, block_number, tx_hash, log_index, timestamp, credit_id, addresses, data
		FROM indexer_events
		WHERE addresses @> $1::jsonb
		ORDER BY block_number ASC, log_index ASC, id ASC
	`, string(addressJSON))
}

func (s *PostgresStore) GetLatestBlock() (uint64, error) {
	ctx, cancel := opContext()
	defer cancel()

	var raw string
	err := s.pool.QueryRow(ctx, `
		SELECT value FROM indexer_state WHERE key = 'latest_block'
	`).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}

	block, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing latest block %q: %w", raw, err)
	}
	return block, nil
}

func (s *PostgresStore) SetLatestBlock(block uint64) error {
	ctx, cancel := opContext()
	defer cancel()

	_, err := s.pool.Exec(ctx, `
		INSERT INTO indexer_state(key, value, updated_at)
		VALUES ('latest_block', $1, now())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_at = now()
	`, fmt.Sprintf("%d", block))
	return err
}

func (s *PostgresStore) GetStats(uptime time.Duration) (*IndexerStats, error) {
	ctx, cancel := opContext()
	defer cancel()

	stats := &IndexerStats{
		EventsByType: make(map[EventType]int64),
		Uptime:       uptime,
	}

	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM indexer_events`).Scan(&stats.TotalEvents); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT type, count(*)
		FROM indexer_events
		GROUP BY type
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var eventType string
		var count int64
		if err := rows.Scan(&eventType, &count); err != nil {
			return nil, err
		}
		stats.EventsByType[EventType(eventType)] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	lastBlock, err := s.GetLatestBlock()
	if err != nil {
		return nil, err
	}
	stats.LastBlock = lastBlock

	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(max(timestamp), '0001-01-01T00:00:00Z'::timestamptz)
		FROM indexer_events
	`).Scan(&stats.LastBlockTime); err != nil {
		return nil, err
	}

	return stats, nil
}

func (s *PostgresStore) DeleteEventsFromBlock(blockNum uint64) error {
	ctx, cancel := opContext()
	defer cancel()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM indexer_events WHERE block_number >= $1`, blockNum); err != nil {
		return err
	}

	latest := uint64(0)
	if blockNum > 0 {
		latest = blockNum - 1
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO indexer_state(key, value, updated_at)
		VALUES ('latest_block', $1, now())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_at = now()
	`, fmt.Sprintf("%d", latest)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) queryEvents(query string, args ...any) ([]Event, error) {
	ctx, cancel := opContext()
	defer cancel()

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return events, nil
}

type eventScanner interface {
	Scan(dest ...any) error
}

func scanEvent(scanner eventScanner) (Event, error) {
	var event Event
	var eventType string
	var logIndex int64
	var addressesRaw []byte
	var dataRaw []byte

	if err := scanner.Scan(
		&event.ID,
		&eventType,
		&event.BlockNumber,
		&event.TxHash,
		&logIndex,
		&event.Timestamp,
		&event.CreditID,
		&addressesRaw,
		&dataRaw,
	); err != nil {
		return Event{}, err
	}

	event.Type = EventType(eventType)
	event.LogIndex = uint(logIndex)
	if err := json.Unmarshal(addressesRaw, &event.Addresses); err != nil {
		return Event{}, fmt.Errorf("decoding addresses for event %s: %w", event.ID, err)
	}
	if err := json.Unmarshal(dataRaw, &event.Data); err != nil {
		return Event{}, fmt.Errorf("decoding data for event %s: %w", event.ID, err)
	}
	return event, nil
}

func opContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), storeOpTimeout)
}

func normalizePagination(offset, limit int) (int, int) {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 50
	}
	return offset, limit
}
