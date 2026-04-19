package store

import (
	"context"
	"encoding/json"
	"errors"
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

func (s Store) GetProfile(ctx context.Context) (domain.Profile, error) {
	var data []byte
	var updatedAt time.Time
	err := s.pool.QueryRow(ctx, `SELECT data, updated_at FROM profiles WHERE id = 'default'`).Scan(&data, &updatedAt)
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

func (s Store) SaveProfile(ctx context.Context, profile domain.Profile) (domain.Profile, error) {
	if err := profile.Validate(); err != nil {
		return domain.Profile{}, err
	}
	data, err := json.Marshal(profile)
	if err != nil {
		return domain.Profile{}, err
	}
	var updatedAt time.Time
	err = s.pool.QueryRow(ctx, `
		INSERT INTO profiles(id, data, updated_at)
		VALUES ('default', $1, now())
		ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
		RETURNING updated_at
	`, data).Scan(&updatedAt)
	if err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = updatedAt
	return profile, nil
}

func (s Store) SavePlan(ctx context.Context, plan domain.Plan) (domain.Plan, error) {
	if plan.ID == "" {
		plan.ID = "plan-" + plan.WeekStart
	}
	plan.UpdatedAt = time.Now()
	if plan.CreatedAt.IsZero() {
		plan.CreatedAt = plan.UpdatedAt
	}
	data, err := json.Marshal(plan)
	if err != nil {
		return domain.Plan{}, err
	}
	err = s.pool.QueryRow(ctx, `
		INSERT INTO plans(id, week_start, status, data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (week_start) DO UPDATE SET id = EXCLUDED.id, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
		RETURNING created_at, updated_at
	`, plan.ID, plan.WeekStart, plan.Status, data, plan.CreatedAt, plan.UpdatedAt).Scan(&plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return domain.Plan{}, err
	}
	return plan, nil
}

func (s Store) GetCurrentPlan(ctx context.Context) (domain.Plan, error) {
	var data []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM plans ORDER BY week_start DESC LIMIT 1`).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func (s Store) GetPlan(ctx context.Context, id string) (domain.Plan, error) {
	var data []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM plans WHERE id = $1`, id).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func decodePlan(data []byte) (domain.Plan, error) {
	var plan domain.Plan
	if err := json.Unmarshal(data, &plan); err != nil {
		return domain.Plan{}, err
	}
	return plan, nil
}
