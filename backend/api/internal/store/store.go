package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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

func (s Store) UpsertUser(ctx context.Context, provider, subjectHash string, email string, emailHash string) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users(provider, subject_hash, email, email_hash, last_login_at)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), now())
		ON CONFLICT (provider, subject_hash) DO UPDATE
		SET last_login_at = now(),
		    email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
		    email_hash = COALESCE(NULLIF(EXCLUDED.email_hash, ''), users.email_hash)
		RETURNING id::text
	`, provider, subjectHash, email, emailHash).Scan(&id)
	if err != nil {
		return "", err
	}
	return id, s.ensurePersonalFamily(ctx, id)
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
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (active_family_id) id::text
		FROM users
		WHERE active_family_id IS NOT NULL
		ORDER BY active_family_id, created_at ASC
	`)
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
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.Profile{}, err
	}
	var data []byte
	var updatedAt time.Time
	err = s.pool.QueryRow(ctx, `SELECT data, updated_at FROM profiles WHERE family_id = $1`, familyID).Scan(&data, &updatedAt)
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
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.Profile{}, err
	}
	data, err := json.Marshal(profile)
	if err != nil {
		return domain.Profile{}, err
	}
	var updatedAt time.Time
	err = s.pool.QueryRow(ctx, `
		INSERT INTO profiles(id, user_id, family_id, data, updated_at)
		VALUES ($1, $2::uuid, $3::uuid, $4, now())
		ON CONFLICT (family_id) WHERE family_id IS NOT NULL DO UPDATE SET data = EXCLUDED.data, updated_at = now()
		RETURNING updated_at
	`, familyID, userID, familyID, data).Scan(&updatedAt)
	if err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = updatedAt
	return profile, nil
}

func (s Store) SavePlan(ctx context.Context, userID string, plan domain.Plan) (domain.Plan, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.Plan{}, err
	}
	if plan.ID == "" {
		plan.ID = "plan-" + plan.WeekStart
	}
	plan.ID = scopedPlanID(familyID, plan.ID)
	plan.UpdatedAt = time.Now()
	if plan.CreatedAt.IsZero() {
		plan.CreatedAt = plan.UpdatedAt
	}
	data, err := json.Marshal(plan)
	if err != nil {
		return domain.Plan{}, err
	}
	err = s.pool.QueryRow(ctx, `
		INSERT INTO plans(id, user_id, family_id, week_start, status, data, created_at, updated_at)
		VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
		ON CONFLICT (family_id, week_start) WHERE family_id IS NOT NULL DO UPDATE SET id = EXCLUDED.id, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
		RETURNING created_at, updated_at
	`, plan.ID, userID, familyID, plan.WeekStart, plan.Status, data, plan.CreatedAt, plan.UpdatedAt).Scan(&plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return domain.Plan{}, err
	}
	return plan, nil
}

func (s Store) GetCurrentPlan(ctx context.Context, userID string) (domain.Plan, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.Plan{}, err
	}
	var data []byte
	err = s.pool.QueryRow(ctx, `SELECT data FROM plans WHERE family_id = $1 ORDER BY week_start DESC LIMIT 1`, familyID).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func (s Store) GetPlan(ctx context.Context, userID string, id string) (domain.Plan, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.Plan{}, err
	}
	var data []byte
	err = s.pool.QueryRow(ctx, `SELECT data FROM plans WHERE family_id = $1 AND id = $2`, familyID, id).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Plan{}, ErrNotFound
	}
	if err != nil {
		return domain.Plan{}, err
	}
	return decodePlan(data)
}

func (s Store) GetFamily(ctx context.Context, userID string) (domain.FamilySummary, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	var summary domain.FamilySummary
	var status string
	err = s.pool.QueryRow(ctx, `
		SELECT f.id::text, f.name, f.owner_user_id = $1::uuid, f.status, f.created_at, COUNT(fm.user_id)
		FROM families f
		LEFT JOIN family_members fm ON fm.family_id = f.id
		WHERE f.id = $2
		GROUP BY f.id
	`, userID, familyID).Scan(&summary.ID, &summary.Name, &summary.Personal, &status, &summary.CreatedAt, &summary.MemberCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.FamilySummary{}, ErrNotFound
	}
	if status == "merged" {
		summary.MergedWarning = "Dieser persoenliche Account ist in einem Familienaccount aufgegangen."
	}
	profile, err := s.GetProfileByFamily(ctx, familyID)
	if err == nil {
		for _, member := range profile.Members {
			if strings.TrimSpace(member.ID) == "" || strings.TrimSpace(member.Name) == "" {
				continue
			}
			summary.Members = append(summary.Members, domain.FamilyMemberSummary{
				ID:    strings.TrimSpace(member.ID),
				Name:  strings.TrimSpace(member.Name),
				Alias: strings.TrimSpace(member.Alias),
			})
		}
	}
	rows, err := s.pool.Query(ctx, `
		SELECT fm.user_id::text, COALESCE(u.email, ''), fm.role, COALESCE(fm.linked_member_id, '')
		FROM family_members fm
		JOIN users u ON u.id = fm.user_id
		WHERE fm.family_id = $1
		ORDER BY fm.created_at ASC
	`, familyID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var account domain.FamilyAccount
		if err := rows.Scan(&account.UserID, &account.Email, &account.Role, &account.LinkedMemberID); err != nil {
			return domain.FamilySummary{}, err
		}
		summary.Accounts = append(summary.Accounts, account)
	}
	if err := rows.Err(); err != nil {
		return domain.FamilySummary{}, err
	}
	return summary, err
}

func (s Store) CreateFamilyInvite(ctx context.Context, userID string, emailHash string, ttl time.Duration) (domain.FamilyInvite, string, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FamilyInvite{}, "", err
	}
	token, err := randomToken(32)
	if err != nil {
		return domain.FamilyInvite{}, "", err
	}
	tokenHash := tokenDigest(token)
	expiresAt := time.Now().UTC().Add(ttl)
	var invite domain.FamilyInvite
	err = s.pool.QueryRow(ctx, `
		INSERT INTO family_invites(family_id, invited_by_user_id, email_hash, token_hash, expires_at)
		VALUES ($1, $2::uuid, $3, $4, $5)
		RETURNING id::text, email_hash, expires_at, created_at
	`, familyID, userID, emailHash, tokenHash, expiresAt).Scan(&invite.ID, &invite.EmailHash, &invite.ExpiresAt, &invite.CreatedAt)
	if err != nil {
		return domain.FamilyInvite{}, "", err
	}
	invite.WarningText = familyMergeWarning()
	return invite, token, nil
}

func (s Store) AcceptFamilyInvite(ctx context.Context, userID string, token string, mergedProfile domain.Profile) (domain.FamilySummary, error) {
	tokenHash := tokenDigest(token)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	defer tx.Rollback(ctx)

	sourceFamilyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	emailHash, err := s.UserEmailHash(ctx, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	var targetFamilyID string
	err = tx.QueryRow(ctx, `
		SELECT family_id::text
		FROM family_invites
		WHERE token_hash = $1 AND email_hash = $2 AND accepted_at IS NULL AND expires_at > now()
	`, tokenHash, emailHash).Scan(&targetFamilyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.FamilySummary{}, ErrNotFound
	}
	if err != nil {
		return domain.FamilySummary{}, err
	}
	data, err := json.Marshal(mergedProfile)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO profiles(id, user_id, family_id, data, updated_at)
		VALUES ($1, $2::uuid, $3::uuid, $4, now())
		ON CONFLICT (family_id) WHERE family_id IS NOT NULL DO UPDATE SET data = EXCLUDED.data, updated_at = now()
	`, targetFamilyID, userID, targetFamilyID, data)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO family_members(family_id, user_id, role) VALUES ($1, $2::uuid, 'member') ON CONFLICT DO NOTHING`, targetFamilyID, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE users SET active_family_id = $1 WHERE id = $2::uuid`, targetFamilyID, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE families SET status = 'merged', merged_into_family_id = $1 WHERE id = $2`, targetFamilyID, sourceFamilyID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE family_invites SET accepted_at = now(), accepted_by_user_id = $1::uuid WHERE token_hash = $2`, userID, tokenHash)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.FamilySummary{}, err
	}
	return s.GetFamily(ctx, userID)
}

func (s Store) UpdateFamilyMemberLink(ctx context.Context, userID string, accountUserID string, memberID string) (domain.FamilySummary, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	memberID = strings.TrimSpace(memberID)
	if memberID != "" {
		profile, err := s.GetProfileByFamily(ctx, familyID)
		if err != nil {
			return domain.FamilySummary{}, err
		}
		found := false
		for _, member := range profile.Members {
			if strings.TrimSpace(member.ID) == memberID {
				found = true
				break
			}
		}
		if !found {
			return domain.FamilySummary{}, ErrNotFound
		}
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE family_members
		SET linked_member_id = NULLIF($3, '')
		WHERE family_id = $1 AND user_id = $2::uuid
	`, familyID, accountUserID, memberID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.FamilySummary{}, ErrNotFound
	}
	return s.GetFamily(ctx, userID)
}

func (s Store) UserEmailHash(ctx context.Context, userID string) (string, error) {
	var emailHash string
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(email_hash, '') FROM users WHERE id = $1`, userID).Scan(&emailHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return emailHash, err
}

func (s Store) GetProfileByFamily(ctx context.Context, familyID string) (domain.Profile, error) {
	var data []byte
	var updatedAt time.Time
	err := s.pool.QueryRow(ctx, `SELECT data, updated_at FROM profiles WHERE family_id = $1`, familyID).Scan(&data, &updatedAt)
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

func (s Store) InviteTargetFamily(ctx context.Context, token string) (string, error) {
	var familyID string
	err := s.pool.QueryRow(ctx, `SELECT family_id::text FROM family_invites WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()`, tokenDigest(token)).Scan(&familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return familyID, err
}

func (s Store) ListFavorites(ctx context.Context, userID string) ([]domain.FavoriteRecipe, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `SELECT id::text, data, created_at FROM favorite_recipes WHERE family_id = $1 ORDER BY created_at DESC`, familyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var favorites []domain.FavoriteRecipe
	for rows.Next() {
		var favorite domain.FavoriteRecipe
		var data []byte
		if err := rows.Scan(&favorite.ID, &data, &favorite.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, &favorite.Meal); err != nil {
			return nil, err
		}
		favorites = append(favorites, favorite)
	}
	return favorites, rows.Err()
}

func (s Store) SaveFavorite(ctx context.Context, userID string, meal domain.Meal) (domain.FavoriteRecipe, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FavoriteRecipe{}, err
	}
	data, err := json.Marshal(meal)
	if err != nil {
		return domain.FavoriteRecipe{}, err
	}
	hash := mealHash(meal)
	var favorite domain.FavoriteRecipe
	err = s.pool.QueryRow(ctx, `
		INSERT INTO favorite_recipes(family_id, meal_hash, data)
		VALUES ($1, $2, $3)
		ON CONFLICT (family_id, meal_hash) DO UPDATE SET data = EXCLUDED.data
		RETURNING id::text, data, created_at
	`, familyID, hash, data).Scan(&favorite.ID, &data, &favorite.CreatedAt)
	if err != nil {
		return domain.FavoriteRecipe{}, err
	}
	if err := json.Unmarshal(data, &favorite.Meal); err != nil {
		return domain.FavoriteRecipe{}, err
	}
	return favorite, nil
}

func (s Store) DeleteFavorite(ctx context.Context, userID string, id string) error {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return err
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM favorite_recipes WHERE family_id = $1 AND id = $2`, familyID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s Store) SavePromptDebug(ctx context.Context, userID string, entry domain.PromptDebugEntry) error {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO prompt_debug_entries(family_id, operation, model, prompt) VALUES ($1, $2, $3, $4)`, familyID, entry.Operation, entry.Model, entry.Prompt)
	return err
}

func (s Store) LatestPromptDebug(ctx context.Context, userID string) (domain.PromptDebugEntry, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.PromptDebugEntry{}, err
	}
	var entry domain.PromptDebugEntry
	err = s.pool.QueryRow(ctx, `SELECT operation, model, prompt, created_at FROM prompt_debug_entries WHERE family_id = $1 ORDER BY created_at DESC LIMIT 1`, familyID).Scan(&entry.Operation, &entry.Model, &entry.Prompt, &entry.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.PromptDebugEntry{}, ErrNotFound
	}
	return entry, err
}

func (s Store) ListPromptDebug(ctx context.Context, userID string, limit int) ([]domain.PromptDebugEntry, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 5
	}
	rows, err := s.pool.Query(ctx, `SELECT operation, model, prompt, created_at FROM prompt_debug_entries WHERE family_id = $1 ORDER BY created_at DESC LIMIT $2`, familyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []domain.PromptDebugEntry
	for rows.Next() {
		var entry domain.PromptDebugEntry
		if err := rows.Scan(&entry.Operation, &entry.Model, &entry.Prompt, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, ErrNotFound
	}
	return entries, nil
}

func (s Store) activeFamilyID(ctx context.Context, userID string) (string, error) {
	if err := s.ensurePersonalFamily(ctx, userID); err != nil {
		return "", err
	}
	var familyID string
	err := s.pool.QueryRow(ctx, `SELECT active_family_id::text FROM users WHERE id = $1`, userID).Scan(&familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return familyID, err
}

func (s Store) ensurePersonalFamily(ctx context.Context, userID string) error {
	var activeFamilyID *string
	err := s.pool.QueryRow(ctx, `SELECT active_family_id::text FROM users WHERE id = $1`, userID).Scan(&activeFamilyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if activeFamilyID != nil && strings.TrimSpace(*activeFamilyID) != "" {
		return nil
	}
	var familyID string
	err = s.pool.QueryRow(ctx, `INSERT INTO families(name, owner_user_id) VALUES ('Persoenliche Familie', $1::uuid) RETURNING id::text`, userID).Scan(&familyID)
	if err != nil {
		return err
	}
	if _, err := s.pool.Exec(ctx, `UPDATE users SET active_family_id = $1 WHERE id = $2::uuid`, familyID, userID); err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO family_members(family_id, user_id, role) VALUES ($1, $2::uuid, 'owner') ON CONFLICT DO NOTHING`, familyID, userID)
	return err
}

func (s Store) GetPlanByID(ctx context.Context, id string) (domain.Plan, error) {
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

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func tokenDigest(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func mealHash(meal domain.Meal) string {
	key := strings.ToLower(strings.TrimSpace(meal.ID + "|" + meal.Title + "|" + meal.Slot))
	if key == "||" {
		key = string(mustJSON(meal))
	}
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

func mustJSON(value any) []byte {
	data, _ := json.Marshal(value)
	return data
}

func familyMergeWarning() string {
	return "Wenn du diese Einladung annimmst, geht dein persoenlicher Account im Familienaccount auf. Dein Profil wird sinnvoll zusammengefuehrt."
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
