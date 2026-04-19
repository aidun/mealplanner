package store

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) Store {
	return Store{pool: pool}
}

func (s Store) UpsertUser(ctx context.Context, provider, subjectHash string) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users(provider, subject_hash, last_login_at)
		VALUES ($1, $2, now())
		ON CONFLICT (provider, subject_hash) DO UPDATE SET last_login_at = now()
		RETURNING id::text
	`, provider, subjectHash).Scan(&id)
	return id, err
}

func (s Store) CreateSession(ctx context.Context, userID string, ttl time.Duration) (sessionID, csrfToken string, expiresAt time.Time, err error) {
	csrfToken, err = randomToken(32)
	if err != nil {
		return "", "", time.Time{}, err
	}
	expiresAt = time.Now().UTC().Add(ttl)
	err = s.pool.QueryRow(ctx, `
		INSERT INTO sessions(user_id, csrf_token, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, userID, csrfToken, expiresAt).Scan(&sessionID)
	if err != nil {
		return "", "", time.Time{}, err
	}
	return sessionID, csrfToken, expiresAt, nil
}

func (s Store) GetSession(ctx context.Context, sessionID string) (userID, csrfToken string, expiresAt time.Time, err error) {
	err = s.pool.QueryRow(ctx, `
		SELECT user_id::text, csrf_token, expires_at
		FROM sessions
		WHERE id = $1 AND expires_at > now()
	`, sessionID).Scan(&userID, &csrfToken, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", time.Time{}, ErrNotFound
	}
	return userID, csrfToken, expiresAt, err
}

func (s Store) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, sessionID)
	return err
}

func (s Store) ListUserIDs(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text FROM users ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s Store) GetProfile(ctx context.Context, userID string) (domain.Profile, error) {
	var data []byte
	var updatedAt time.Time
	err := s.pool.QueryRow(ctx, `SELECT data, updated_at FROM profiles WHERE user_id = $1`, userID).Scan(&data, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DefaultProfile(), nil
	}
	if err != nil {
		return domain.Profile{}, err
	}
	var profile domain.Profile
	if err := json.Unmarshal(data, &profile); err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = updatedAt
	return profile, nil
}

func (s Store) SaveProfile(ctx context.Context, userID string, profile domain.Profile) (domain.Profile, error) {
	if err := profile.Validate(); err != nil {
		return domain.Profile{}, err
	}
	data, err := json.Marshal(profile)
	if err != nil {
		return domain.Profile{}, err
	}
	var updatedAt time.Time
	err = s.pool.QueryRow(ctx, `
		INSERT INTO profiles(id, user_id, data, updated_at)
		VALUES ($1, $1::uuid, $2, now())
		ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE SET data = EXCLUDED.data, updated_at = now()
		RETURNING updated_at
	`, userID, data).Scan(&updatedAt)
	if err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = updatedAt
	return profile, nil
}

func (s Store) SavePlan(ctx context.Context, userID string, plan domain.Plan) (domain.Plan, error) {
	if plan.ID == "" {
		plan.ID = "plan-" + plan.WeekStart
	}
	plan.ID = scopedPlanID(userID, plan.ID)
	plan.UpdatedAt = time.Now()
	if plan.CreatedAt.IsZero() {
		plan.CreatedAt = plan.UpdatedAt
	}
	data, err := json.Marshal(plan)
	if err != nil {
		return domain.Plan{}, err
	}
	err = s.pool.QueryRow(ctx, `
		INSERT INTO plans(id, user_id, week_start, status, data, created_at, updated_at)
		VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, week_start) WHERE user_id IS NOT NULL DO UPDATE SET id = EXCLUDED.id, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
		RETURNING created_at, updated_at
	`, plan.ID, userID, plan.WeekStart, plan.Status, data, plan.CreatedAt, plan.UpdatedAt).Scan(&plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return domain.Plan{}, err
	}
	return plan, nil
}

func (s Store) GetCurrentPlan(ctx context.Context, userID string) (domain.Plan, error) {
	var data []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM plans WHERE user_id = $1 ORDER BY week_start DESC LIMIT 1`, userID).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func (s Store) GetPlan(ctx context.Context, userID string, id string) (domain.Plan, error) {
	var data []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM plans WHERE user_id = $1 AND id = $2`, userID, id).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func decodePlan(data []byte) (domain.Plan, error) {
	var plan domain.Plan
	if err := json.Unmarshal(data, &plan); err != nil {
		return domain.Plan{}, err
	}
	return plan, nil
}

func scopedPlanID(userID string, planID string) string {
	prefix := strings.ReplaceAll(userID, "-", "")
	if len(prefix) > 12 {
		prefix = prefix[:12]
	}
	if prefix == "" || strings.HasPrefix(planID, prefix+"-") {
		return planID
	}
	return prefix + "-" + planID
}
