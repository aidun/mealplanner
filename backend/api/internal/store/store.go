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
	"github.com/aidun/mealplanner/backend/api/internal/mailer"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

const adminEmail = "markush1986@gmail.com"

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

func (s Store) GetUserEmail(ctx context.Context, userID string) (string, error) {
	var email string
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(email, '') FROM users WHERE id = $1`, userID).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return strings.TrimSpace(email), err
}

func (s Store) IsPremiumUser(ctx context.Context, userID string) (bool, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return false, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(u.email, ''), COALESCE(u.email_hash, '')
		FROM family_members fm
		JOIN users u ON u.id = fm.user_id
		WHERE fm.family_id = $1
	`, familyID)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	emailHashes := make([]string, 0, 4)
	for rows.Next() {
		var email string
		var emailHash string
		if err := rows.Scan(&email, &emailHash); err != nil {
			return false, err
		}
		if normalizeEmail(email) == adminEmail {
			return true, nil
		}
		if strings.TrimSpace(emailHash) != "" {
			emailHashes = append(emailHashes, strings.TrimSpace(emailHash))
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}
	if len(emailHashes) == 0 {
		return false, nil
	}
	var premiumCount int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM premium_users WHERE email_hash = ANY($1)`, emailHashes).Scan(&premiumCount); err != nil {
		return false, err
	}
	return premiumCount > 0, nil
}

func (s Store) LoginAllowed(ctx context.Context, email string, emailHash string) (bool, error) {
	email = normalizeEmail(email)
	if email == adminEmail {
		return true, nil
	}
	if strings.TrimSpace(emailHash) == "" {
		return false, nil
	}
	var directPremium bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM premium_users WHERE email_hash = $1)`, emailHash).Scan(&directPremium); err != nil {
		return false, err
	}
	if directPremium {
		return true, nil
	}
	var familyPremium bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM users u
			JOIN family_members current_member ON current_member.user_id = u.id
			JOIN family_members family_member ON family_member.family_id = current_member.family_id
			JOIN users family_user ON family_user.id = family_member.user_id
			JOIN premium_users pu ON pu.email_hash = family_user.email_hash
			WHERE u.email_hash = $1
		)
	`, emailHash).Scan(&familyPremium)
	return familyPremium, err
}

func (s Store) GetAccountSettings(ctx context.Context, userID string) (domain.AccountSettings, error) {
	var settings domain.AccountSettings
	err := s.pool.QueryRow(ctx, `
		SELECT weekly_plan_email_enabled, recipe_email_enabled, updated_at
		FROM user_settings
		WHERE user_id = $1::uuid
	`, userID).Scan(&settings.WeeklyPlanEmailEnabled, &settings.RecipeEmailEnabled, &settings.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AccountSettings{WeeklyPlanEmailEnabled: true, RecipeEmailEnabled: true}, nil
	}
	return settings, err
}

func (s Store) SaveAccountSettings(ctx context.Context, userID string, settings domain.AccountSettings) (domain.AccountSettings, error) {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO user_settings(user_id, weekly_plan_email_enabled, recipe_email_enabled, updated_at)
		VALUES ($1::uuid, $2, $3, now())
		ON CONFLICT (user_id) DO UPDATE
		SET weekly_plan_email_enabled = EXCLUDED.weekly_plan_email_enabled,
		    recipe_email_enabled = EXCLUDED.recipe_email_enabled,
		    updated_at = now()
		RETURNING updated_at
	`, userID, settings.WeeklyPlanEmailEnabled, settings.RecipeEmailEnabled).Scan(&settings.UpdatedAt)
	return settings, err
}

func (s Store) ListPremiumInvites(ctx context.Context, limit int) ([]domain.PremiumInvite, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, email, created_at
		FROM premium_invites
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.PremiumInvite, 0, limit)
	for rows.Next() {
		var item domain.PremiumInvite
		if err := rows.Scan(&item.ID, &item.Email, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.EmailSent = true
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s Store) CreatePremiumInvite(ctx context.Context, invitedByUserID string, email string, emailHash string) (domain.PremiumInvite, error) {
	var invite domain.PremiumInvite
	err := s.pool.QueryRow(ctx, `
		INSERT INTO premium_invites(email, email_hash, invited_by_user_id)
		VALUES ($1, $2, $3::uuid)
		RETURNING id::text, email, created_at
	`, normalizeEmail(email), strings.TrimSpace(emailHash), invitedByUserID).Scan(&invite.ID, &invite.Email, &invite.CreatedAt)
	if err != nil {
		return domain.PremiumInvite{}, err
	}
	invite.EmailSent = true
	return invite, nil
}

func (s Store) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, sessionID)
	return err
}

func (s Store) SaveFeedback(ctx context.Context, userID, message, page string) (domain.FeedbackEntry, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FeedbackEntry{}, err
	}
	var entry domain.FeedbackEntry
	err = s.pool.QueryRow(ctx, `
		INSERT INTO feedback_entries(user_id, family_id, message, page, status)
		VALUES ($1, $2::uuid, $3, NULLIF($4, ''), 'open')
		RETURNING id::text, message, COALESCE(page, ''), status, created_at, COALESCE(resolved_at, to_timestamp(0)), COALESCE(resolved_by_user_id::text, '')
	`, userID, familyID, strings.TrimSpace(message), strings.TrimSpace(page)).Scan(
		&entry.ID,
		&entry.Message,
		&entry.Page,
		&entry.Status,
		&entry.CreatedAt,
		&entry.ResolvedAt,
		&entry.ResolvedByUserID,
	)
	if err != nil {
		return domain.FeedbackEntry{}, err
	}
	if entry.ResolvedAt.Equal(time.Unix(0, 0).UTC()) {
		entry.ResolvedAt = time.Time{}
	}
	return entry, nil
}

func (s Store) ListFeedback(ctx context.Context, status string, limit int) ([]domain.FeedbackEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		status = "open"
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, message, COALESCE(page, ''), status, created_at, COALESCE(resolved_at, to_timestamp(0)), COALESCE(resolved_by_user_id::text, '')
		FROM feedback_entries
		WHERE status = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]domain.FeedbackEntry, 0, limit)
	for rows.Next() {
		var entry domain.FeedbackEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.Message,
			&entry.Page,
			&entry.Status,
			&entry.CreatedAt,
			&entry.ResolvedAt,
			&entry.ResolvedByUserID,
		); err != nil {
			return nil, err
		}
		if entry.ResolvedAt.Equal(time.Unix(0, 0).UTC()) {
			entry.ResolvedAt = time.Time{}
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

func (s Store) ResolveFeedback(ctx context.Context, resolverUserID, feedbackID string) (domain.FeedbackEntry, error) {
	var entry domain.FeedbackEntry
	err := s.pool.QueryRow(ctx, `
		UPDATE feedback_entries
		SET status = 'resolved',
		    resolved_at = now(),
		    resolved_by_user_id = $2::uuid
		WHERE id = $1::uuid
		  AND status <> 'resolved'
		RETURNING id::text, message, COALESCE(page, ''), status, created_at, COALESCE(resolved_at, to_timestamp(0)), COALESCE(resolved_by_user_id::text, '')
	`, feedbackID, resolverUserID).Scan(
		&entry.ID,
		&entry.Message,
		&entry.Page,
		&entry.Status,
		&entry.CreatedAt,
		&entry.ResolvedAt,
		&entry.ResolvedByUserID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.FeedbackEntry{}, ErrNotFound
		}
		return domain.FeedbackEntry{}, err
	}
	if entry.ResolvedAt.Equal(time.Unix(0, 0).UTC()) {
		entry.ResolvedAt = time.Time{}
	}
	return entry, nil
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
	if err == nil && !domain.IsPlaceholderProfile(profile) {
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
		SELECT fm.user_id::text,
		       COALESCE(u.email, ''),
		       fm.role,
		       COALESCE(fm.linked_member_id, ''),
		       COALESCE(us.weekly_plan_email_enabled, true),
		       COALESCE(us.recipe_email_enabled, true),
		       us.updated_at
		FROM family_members fm
		JOIN users u ON u.id = fm.user_id
		LEFT JOIN user_settings us ON us.user_id = fm.user_id
		WHERE fm.family_id = $1
		ORDER BY fm.created_at ASC
	`, familyID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var account domain.FamilyAccount
		if err := rows.Scan(
			&account.UserID,
			&account.Email,
			&account.Role,
			&account.LinkedMemberID,
			&account.Settings.WeeklyPlanEmailEnabled,
			&account.Settings.RecipeEmailEnabled,
			&account.Settings.UpdatedAt,
		); err != nil {
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

func (s Store) UpdateFamilyAccountSettings(ctx context.Context, userID string, accountUserID string, settings domain.AccountSettings) (domain.FamilySummary, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.FamilySummary{}, err
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM family_members
			WHERE family_id = $1 AND user_id = $2::uuid
		)
	`, familyID, accountUserID).Scan(&exists); err != nil {
		return domain.FamilySummary{}, err
	}
	if !exists {
		return domain.FamilySummary{}, ErrNotFound
	}
	if _, err := s.SaveAccountSettings(ctx, accountUserID, settings); err != nil {
		return domain.FamilySummary{}, err
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
	meta, err := json.Marshal(entry.Meta)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO prompt_debug_entries(family_id, operation, model, prompt, meta) VALUES ($1, $2, $3, $4, $5)`, familyID, entry.Operation, entry.Model, entry.Prompt, meta)
	return err
}

func (s Store) ListPremiumUsers(ctx context.Context) ([]domain.PremiumUser, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, email, created_at FROM premium_users ORDER BY created_at DESC, email ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []domain.PremiumUser
	for rows.Next() {
		var user domain.PremiumUser
		if err := rows.Scan(&user.ID, &user.Email, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s Store) SavePremiumUser(ctx context.Context, grantedByUserID string, email string, emailHash string) (domain.PremiumUser, error) {
	email = normalizeEmail(email)
	var user domain.PremiumUser
	err := s.pool.QueryRow(ctx, `
		INSERT INTO premium_users(email, email_hash, granted_by_user_id)
		VALUES ($1, $2, $3::uuid)
		ON CONFLICT (email) DO UPDATE SET email_hash = EXCLUDED.email_hash
		RETURNING id::text, email, created_at
	`, email, strings.TrimSpace(emailHash), grantedByUserID).Scan(&user.ID, &user.Email, &user.CreatedAt)
	return user, err
}

func (s Store) ListMailTemplates(ctx context.Context) ([]domain.MailTemplate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT kind, subject_template, text_template, html_template, updated_at
		FROM mail_templates
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	overrides := map[string]domain.MailTemplate{}
	for rows.Next() {
		var item domain.MailTemplate
		if err := rows.Scan(&item.Kind, &item.Subject, &item.TextBody, &item.HTMLBody, &item.UpdatedAt); err != nil {
			return nil, err
		}
		overrides[item.Kind] = item
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	templates := make([]domain.MailTemplate, 0, len(mailer.DefaultTemplateKinds()))
	for _, kind := range mailer.DefaultTemplateKinds() {
		defaults, ok := mailer.DefaultTemplate(kind)
		if !ok {
			continue
		}
		item := domain.MailTemplate{
			Kind:         kind,
			Label:        defaults.Label,
			Subject:      defaults.Subject,
			TextBody:     defaults.TextBody,
			HTMLBody:     defaults.HTMLBody,
			Description:  defaults.Description,
			VariableHint: append([]string(nil), defaults.Variables...),
		}
		if override, ok := overrides[kind]; ok {
			item.Subject = override.Subject
			item.TextBody = override.TextBody
			item.HTMLBody = override.HTMLBody
			item.UpdatedAt = override.UpdatedAt
		}
		templates = append(templates, item)
	}
	return templates, nil
}

func (s Store) SaveMailTemplate(ctx context.Context, kind string, update domain.UpdateMailTemplateRequest) (domain.MailTemplate, error) {
	defaults, ok := mailer.DefaultTemplate(kind)
	if !ok {
		return domain.MailTemplate{}, ErrNotFound
	}
	item := domain.MailTemplate{
		Kind:         kind,
		Label:        defaults.Label,
		Subject:      strings.TrimSpace(update.Subject),
		TextBody:     strings.TrimSpace(update.TextBody),
		HTMLBody:     strings.TrimSpace(update.HTMLBody),
		Description:  defaults.Description,
		VariableHint: append([]string(nil), defaults.Variables...),
	}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO mail_templates(kind, subject_template, text_template, html_template, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (kind) DO UPDATE
		SET subject_template = EXCLUDED.subject_template,
		    text_template = EXCLUDED.text_template,
		    html_template = EXCLUDED.html_template,
		    updated_at = now()
		RETURNING updated_at
	`, item.Kind, item.Subject, item.TextBody, item.HTMLBody).Scan(&item.UpdatedAt)
	return item, err
}

func (s Store) DeletePremiumUser(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM premium_users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s Store) RecordGenerationEvent(ctx context.Context, userID string, category string) error {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO generation_events(family_id, category) VALUES ($1, $2)`, familyID, strings.TrimSpace(category))
	return err
}

func (s Store) AdminStats(ctx context.Context) (domain.AdminStats, error) {
	accountCounts, err := s.familyCounts(ctx, `
		SELECT f.id::text, COUNT(fm.user_id)::int
		FROM families f
		LEFT JOIN family_members fm ON fm.family_id = f.id
		WHERE f.status = 'active'
		GROUP BY f.id
	`)
	if err != nil {
		return domain.AdminStats{}, err
	}
	memberCounts, err := s.familyCounts(ctx, `
		SELECT f.id::text, COALESCE(jsonb_array_length(COALESCE(p.data->'members', '[]'::jsonb)), 0)::int
		FROM families f
		LEFT JOIN profiles p ON p.family_id = f.id
		WHERE f.status = 'active'
	`)
	if err != nil {
		return domain.AdminStats{}, err
	}
	stats := domain.AdminStats{
		AverageActiveAccountsPerFamily: averageCounts(accountCounts),
		AverageProfileMembersPerFamily: averageCounts(memberCounts),
		FamilyDistributionByAccounts:   bucketCounts(accountCounts),
		FamilyDistributionByMembers:    bucketCounts(memberCounts),
	}
	rows, err := s.pool.Query(ctx, `
		SELECT category, COUNT(*)::int
		FROM generation_events
		GROUP BY category
		ORDER BY category ASC
	`)
	if err != nil {
		return domain.AdminStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.GenerationCount
		if err := rows.Scan(&item.Category, &item.Count); err != nil {
			return domain.AdminStats{}, err
		}
		stats.Generations = append(stats.Generations, item)
	}
	return stats, rows.Err()
}

func (s Store) LatestPromptDebug(ctx context.Context, userID string) (domain.PromptDebugEntry, error) {
	familyID, err := s.activeFamilyID(ctx, userID)
	if err != nil {
		return domain.PromptDebugEntry{}, err
	}
	var entry domain.PromptDebugEntry
	var meta []byte
	err = s.pool.QueryRow(ctx, `SELECT operation, model, prompt, meta, created_at FROM prompt_debug_entries WHERE family_id = $1 ORDER BY created_at DESC LIMIT 1`, familyID).Scan(&entry.Operation, &entry.Model, &entry.Prompt, &meta, &entry.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.PromptDebugEntry{}, ErrNotFound
	}
	if err == nil {
		entry.Meta = decodePromptMeta(meta)
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
	rows, err := s.pool.Query(ctx, `SELECT operation, model, prompt, meta, created_at FROM prompt_debug_entries WHERE family_id = $1 ORDER BY created_at DESC LIMIT $2`, familyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []domain.PromptDebugEntry
	for rows.Next() {
		var entry domain.PromptDebugEntry
		var meta []byte
		if err := rows.Scan(&entry.Operation, &entry.Model, &entry.Prompt, &meta, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entry.Meta = decodePromptMeta(meta)
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

func decodePromptMeta(value []byte) map[string]string {
	if len(value) == 0 || string(value) == "null" {
		return nil
	}
	var meta map[string]string
	if err := json.Unmarshal(value, &meta); err != nil {
		return nil
	}
	if len(meta) == 0 {
		return nil
	}
	return meta
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
		return s.ensureFamilyMembership(ctx, strings.TrimSpace(*activeFamilyID), userID)
	}
	var familyID string
	err = s.pool.QueryRow(ctx, `INSERT INTO families(name, owner_user_id) VALUES ('Persoenliche Familie', $1::uuid) RETURNING id::text`, userID).Scan(&familyID)
	if err != nil {
		return err
	}
	if _, err := s.pool.Exec(ctx, `UPDATE users SET active_family_id = $1 WHERE id = $2::uuid`, familyID, userID); err != nil {
		return err
	}
	return s.ensureFamilyMembership(ctx, familyID, userID)
}

func (s Store) ensureFamilyMembership(ctx context.Context, familyID string, userID string) error {
	var role string
	err := s.pool.QueryRow(ctx, `
		SELECT CASE WHEN owner_user_id = $2::uuid THEN 'owner' ELSE 'member' END
		FROM families
		WHERE id = $1
	`, familyID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO family_members(family_id, user_id, role)
		VALUES ($1, $2::uuid, $3)
		ON CONFLICT DO NOTHING
	`, familyID, userID, role)
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

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s Store) familyCounts(ctx context.Context, query string) ([]int, error) {
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := []int{}
	for rows.Next() {
		var familyID string
		var count int
		if err := rows.Scan(&familyID, &count); err != nil {
			return nil, err
		}
		counts = append(counts, count)
	}
	return counts, rows.Err()
}

func averageCounts(counts []int) float64 {
	if len(counts) == 0 {
		return 0
	}
	total := 0
	for _, count := range counts {
		total += count
	}
	return float64(total) / float64(len(counts))
}

func bucketCounts(counts []int) []domain.StatsBucket {
	buckets := []domain.StatsBucket{
		{Label: "1", Count: 0},
		{Label: "2", Count: 0},
		{Label: "3", Count: 0},
		{Label: "4+", Count: 0},
	}
	for _, count := range counts {
		switch {
		case count <= 1:
			buckets[0].Count++
		case count == 2:
			buckets[1].Count++
		case count == 3:
			buckets[2].Count++
		default:
			buckets[3].Count++
		}
	}
	return buckets
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
