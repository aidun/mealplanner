package httpapi

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/mailer"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/provider"
	"github.com/aidun/mealplanner/backend/api/internal/store"
)

type memoryRepo struct {
	profiles        map[string]domain.Profile
	plans           map[string]domain.Plan
	sessions        map[string]memorySession
	emails          map[string]string
	emailHashes     map[string]string
	premiumUsers    map[string]domain.PremiumUser
	premiumInvites  []domain.PremiumInvite
	accountSettings map[string]domain.AccountSettings
	onboardingSeen  map[string]bool
	mailTemplates   map[string]domain.MailTemplate
	activeFamilies  map[string]string
	familyMembers   map[string]map[string]memoryFamilyMember
	invites         map[string]memoryInvite
	favorites       map[string][]domain.FavoriteRecipe
	prompts         map[string][]domain.PromptDebugEntry
	generation      map[string]int
	feedback        []domain.FeedbackEntry
}

type memorySession struct {
	userID    string
	csrf      string
	expiresAt time.Time
}

type memoryInvite struct {
	targetFamilyID string
	emailHash      string
	token          string
	expiresAt      time.Time
}

type memoryFamilyMember struct {
	role           string
	linkedMemberID string
}

type spyMailer struct {
	invites       []mailer.InviteEmail
	premium       []mailer.PremiumInviteEmail
	weekly        []mailer.WeeklyPlanReadyEmail
	err           error
	inviteErrFor  map[string]error
	premiumErrFor map[string]error
	weeklyErrFor  map[string]error
}

func (m *spyMailer) SendInviteEmail(_ context.Context, payload mailer.InviteEmail) error {
	m.invites = append(m.invites, payload)
	if err, ok := m.inviteErrFor[strings.ToLower(strings.TrimSpace(payload.To))]; ok {
		return err
	}
	return m.err
}

func (m *spyMailer) SendWeeklyPlanReadyEmail(_ context.Context, payload mailer.WeeklyPlanReadyEmail) error {
	m.weekly = append(m.weekly, payload)
	if err, ok := m.weeklyErrFor[strings.ToLower(strings.TrimSpace(payload.To))]; ok {
		return err
	}
	return m.err
}

func (m *spyMailer) SendPremiumInviteEmail(_ context.Context, payload mailer.PremiumInviteEmail) error {
	m.premium = append(m.premium, payload)
	if err, ok := m.premiumErrFor[strings.ToLower(strings.TrimSpace(payload.To))]; ok {
		return err
	}
	return m.err
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{
		profiles:        map[string]domain.Profile{},
		plans:           map[string]domain.Plan{},
		sessions:        map[string]memorySession{},
		emails:          map[string]string{},
		emailHashes:     map[string]string{},
		premiumUsers:    map[string]domain.PremiumUser{},
		accountSettings: map[string]domain.AccountSettings{},
		onboardingSeen:  map[string]bool{},
		mailTemplates:   map[string]domain.MailTemplate{},
		activeFamilies:  map[string]string{},
		familyMembers:   map[string]map[string]memoryFamilyMember{},
		invites:         map[string]memoryInvite{},
		favorites:       map[string][]domain.FavoriteRecipe{},
		prompts:         map[string][]domain.PromptDebugEntry{},
		generation:      map[string]int{},
		feedback:        []domain.FeedbackEntry{},
	}
}

func (m *memoryRepo) UpsertUser(_ *http.Request, _, subjectHash string, email string, emailHash string) (string, error) {
	userID := "user-" + subjectHash
	if subjectHash == "" || subjectHash == "subject" {
		userID = "user-1"
	}
	m.emails[userID] = email
	m.emailHashes[userID] = emailHash
	m.ensureFamily(userID)
	return userID, nil
}

func (m *memoryRepo) CreateSession(_ *http.Request, userID string, ttl time.Duration) (string, string, time.Time, error) {
	sessionID := "session-" + userID
	csrf := "csrf-" + userID
	expiresAt := time.Now().Add(ttl)
	m.sessions[sessionID] = memorySession{userID: userID, csrf: csrf, expiresAt: expiresAt}
	return sessionID, csrf, expiresAt, nil
}

func (m *memoryRepo) GetUserEmail(_ *http.Request, userID string) (string, error) {
	return m.emails[userID], nil
}

func (m *memoryRepo) IsPremiumUser(_ *http.Request, userID string) (bool, error) {
	familyID := m.familyID(userID)
	for memberUserID := range m.familyMembers[familyID] {
		email := strings.TrimSpace(m.emails[memberUserID])
		if strings.EqualFold(email, "markush1986@gmail.com") {
			return true, nil
		}
		for _, premiumUser := range m.premiumUsers {
			if strings.EqualFold(strings.TrimSpace(premiumUser.Email), email) {
				return true, nil
			}
		}
	}
	return false, nil
}

func (m *memoryRepo) LoginAllowed(_ *http.Request, email string, emailHash string) (bool, error) {
	if strings.EqualFold(strings.TrimSpace(email), "markush1986@gmail.com") {
		return true, nil
	}
	for _, premiumUser := range m.premiumUsers {
		if strings.EqualFold(strings.TrimSpace(premiumUser.Email), strings.TrimSpace(email)) {
			return true, nil
		}
	}
	for userID, hash := range m.emailHashes {
		if hash != emailHash || strings.TrimSpace(emailHash) == "" {
			continue
		}
		allowed, _ := m.IsPremiumUser(nil, userID)
		if allowed {
			return true, nil
		}
	}
	return false, nil
}

func (m *memoryRepo) GetAccountSettings(r *http.Request) (domain.AccountSettings, error) {
	return m.GetAccountSettingsForUser(r, mustUserID(r.Context()))
}

func (m *memoryRepo) SaveAccountSettings(r *http.Request, settings domain.AccountSettings) (domain.AccountSettings, error) {
	settings.UpdatedAt = time.Now()
	m.accountSettings[mustUserID(r.Context())] = settings
	return settings, nil
}

func (m *memoryRepo) HasSeenProfileOnboarding(_ *http.Request, userID string) (bool, error) {
	return m.onboardingSeen[userID], nil
}

func (m *memoryRepo) MarkProfileOnboardingSeen(_ *http.Request, userID string) error {
	m.onboardingSeen[userID] = true
	return nil
}

func (m *memoryRepo) GetAccountSettingsForUser(_ *http.Request, userID string) (domain.AccountSettings, error) {
	settings, ok := m.accountSettings[userID]
	if !ok {
		return domain.AccountSettings{WeeklyPlanEmailEnabled: true, RecipeEmailEnabled: true}, nil
	}
	return settings, nil
}

func (m *memoryRepo) GetSession(_ *http.Request, sessionID string) (string, string, time.Time, error) {
	session, ok := m.sessions[sessionID]
	if !ok || time.Now().After(session.expiresAt) {
		return "", "", time.Time{}, store.ErrNotFound
	}
	return session.userID, session.csrf, session.expiresAt, nil
}

func (m *memoryRepo) DeleteSession(_ *http.Request, sessionID string) error {
	delete(m.sessions, sessionID)
	return nil
}

func (m *memoryRepo) ListUserIDs(_ *http.Request) ([]string, error) {
	seenFamilies := map[string]bool{}
	var ids []string
	for _, session := range m.sessions {
		familyID := m.familyID(session.userID)
		if !seenFamilies[familyID] {
			seenFamilies[familyID] = true
			ids = append(ids, session.userID)
		}
	}
	for userID := range m.activeFamilies {
		familyID := m.familyID(userID)
		if !seenFamilies[familyID] {
			seenFamilies[familyID] = true
			ids = append(ids, userID)
		}
	}
	return ids, nil
}

func (m *memoryRepo) GetProfile(r *http.Request) (domain.Profile, error) {
	familyID := m.familyID(mustUserID(r.Context()))
	if m.profiles[familyID].HouseholdName == "" {
		if legacy := m.profiles[mustUserID(r.Context())]; legacy.HouseholdName != "" {
			return legacy, nil
		}
		return domain.DefaultProfile(), nil
	}
	return m.profiles[familyID], nil
}

func (m *memoryRepo) SaveProfile(r *http.Request, profile domain.Profile) (domain.Profile, error) {
	m.profiles[m.familyID(mustUserID(r.Context()))] = profile
	return profile, nil
}

func (m *memoryRepo) SavePlan(r *http.Request, plan domain.Plan) (domain.Plan, error) {
	m.plans[m.familyID(mustUserID(r.Context()))+"|"+plan.ID] = plan
	return plan, nil
}

func (m *memoryRepo) GetCurrentPlan(r *http.Request) (domain.Plan, error) {
	prefix := m.familyID(mustUserID(r.Context())) + "|"
	for key, plan := range m.plans {
		if strings.HasPrefix(key, prefix) {
			return plan, nil
		}
	}
	legacyPrefix := mustUserID(r.Context()) + "|"
	for key, plan := range m.plans {
		if strings.HasPrefix(key, legacyPrefix) {
			return plan, nil
		}
	}
	return domain.Plan{}, store.ErrNotFound
}

func (m *memoryRepo) GetPlan(r *http.Request, id string) (domain.Plan, error) {
	plan, ok := m.plans[m.familyID(mustUserID(r.Context()))+"|"+id]
	if !ok {
		plan, ok = m.plans[mustUserID(r.Context())+"|"+id]
	}
	if !ok {
		return domain.Plan{}, store.ErrNotFound
	}
	return plan, nil
}

func (m *memoryRepo) GetFamily(r *http.Request) (domain.FamilySummary, error) {
	familyID := m.familyID(mustUserID(r.Context()))
	summary := domain.FamilySummary{ID: familyID, Name: "Familie", MemberCount: len(m.familyMembers[familyID]), Personal: len(m.familyMembers[familyID]) == 1}
	for _, member := range m.profiles[familyID].Members {
		if strings.TrimSpace(member.Name) != "" && strings.TrimSpace(member.ID) != "" {
			summary.Members = append(summary.Members, domain.FamilyMemberSummary{
				ID:    member.ID,
				Name:  member.Name,
				Alias: member.Alias,
			})
		}
	}
	for userID, membership := range m.familyMembers[familyID] {
		summary.Accounts = append(summary.Accounts, domain.FamilyAccount{
			UserID:         userID,
			Email:          m.emails[userID],
			Role:           membership.role,
			LinkedMemberID: membership.linkedMemberID,
			Settings:       m.accountSettingsOrDefault(userID),
		})
	}
	return summary, nil
}

func (m *memoryRepo) CreateFamilyInvite(r *http.Request, emailHash string, ttl time.Duration) (domain.FamilyInvite, string, error) {
	token := "invite-token"
	familyID := m.familyID(mustUserID(r.Context()))
	if invitedUserID, ok := m.userIDByEmailHash(emailHash); ok {
		invitedFamilyID := m.familyID(invitedUserID)
		switch {
		case invitedFamilyID == familyID:
			return domain.FamilyInvite{}, "", store.ErrAccountAlreadyInFamily
		case !m.isPersonalFamily(invitedUserID):
			return domain.FamilyInvite{}, "", store.ErrAccountInDifferentFamily
		}
	}
	expiresAt := time.Now().Add(ttl)
	m.invites[token] = memoryInvite{targetFamilyID: familyID, emailHash: emailHash, token: token, expiresAt: expiresAt}
	return domain.FamilyInvite{ID: "invite-1", EmailHash: emailHash, ExpiresAt: expiresAt, WarningText: "persönlicher Account"}, token, nil
}

func (m *memoryRepo) AcceptFamilyInvite(r *http.Request, token string, mergedProfile domain.Profile) (domain.FamilySummary, error) {
	invite, ok := m.invites[token]
	if !ok || time.Now().After(invite.expiresAt) || m.emailHashes[mustUserID(r.Context())] != invite.emailHash {
		return domain.FamilySummary{}, store.ErrNotFound
	}
	userID := mustUserID(r.Context())
	currentFamilyID := m.familyID(userID)
	switch {
	case currentFamilyID == invite.targetFamilyID:
		return domain.FamilySummary{}, store.ErrAccountAlreadyInFamily
	case !m.isPersonalFamily(userID):
		return domain.FamilySummary{}, store.ErrAccountInDifferentFamily
	}
	m.profiles[invite.targetFamilyID] = mergedProfile
	m.activeFamilies[userID] = invite.targetFamilyID
	if m.familyMembers[invite.targetFamilyID] == nil {
		m.familyMembers[invite.targetFamilyID] = map[string]memoryFamilyMember{}
	}
	m.familyMembers[invite.targetFamilyID][userID] = memoryFamilyMember{role: "member"}
	return m.GetFamily(r)
}

func (m *memoryRepo) UpdateFamilyMemberLink(r *http.Request, accountUserID string, memberID string) (domain.FamilySummary, error) {
	familyID := m.familyID(mustUserID(r.Context()))
	membership, ok := m.familyMembers[familyID][accountUserID]
	if !ok {
		return domain.FamilySummary{}, store.ErrNotFound
	}
	membership.linkedMemberID = memberID
	m.familyMembers[familyID][accountUserID] = membership
	return m.GetFamily(r)
}

func (m *memoryRepo) UpdateFamilyAccountSettings(r *http.Request, accountUserID string, settings domain.AccountSettings) (domain.FamilySummary, error) {
	familyID := m.familyID(mustUserID(r.Context()))
	if _, ok := m.familyMembers[familyID][accountUserID]; !ok {
		return domain.FamilySummary{}, store.ErrNotFound
	}
	settings.UpdatedAt = time.Now()
	m.accountSettings[accountUserID] = settings
	return m.GetFamily(r)
}

func (m *memoryRepo) UserEmailHash(r *http.Request) (string, error) {
	return m.emailHashes[mustUserID(r.Context())], nil
}

func (m *memoryRepo) GetProfileByFamily(_ *http.Request, familyID string) (domain.Profile, error) {
	if m.profiles[familyID].HouseholdName == "" {
		return domain.DefaultProfile(), nil
	}
	return m.profiles[familyID], nil
}

func (m *memoryRepo) InviteTargetFamily(_ *http.Request, token string) (string, error) {
	invite, ok := m.invites[token]
	if !ok || time.Now().After(invite.expiresAt) {
		return "", store.ErrNotFound
	}
	return invite.targetFamilyID, nil
}

func (m *memoryRepo) ListFavorites(r *http.Request) ([]domain.FavoriteRecipe, error) {
	return append([]domain.FavoriteRecipe(nil), m.favorites[m.familyID(mustUserID(r.Context()))]...), nil
}

func (m *memoryRepo) SaveFavorite(r *http.Request, meal domain.Meal) (domain.FavoriteRecipe, error) {
	familyID := m.familyID(mustUserID(r.Context()))
	favorite := domain.FavoriteRecipe{ID: "favorite-" + meal.ID, Meal: meal, CreatedAt: time.Now()}
	m.favorites[familyID] = append(m.favorites[familyID], favorite)
	return favorite, nil
}

func (m *memoryRepo) DeleteFavorite(r *http.Request, id string) error {
	familyID := m.familyID(mustUserID(r.Context()))
	next := m.favorites[familyID][:0]
	deleted := false
	for _, favorite := range m.favorites[familyID] {
		if favorite.ID == id {
			deleted = true
			continue
		}
		next = append(next, favorite)
	}
	m.favorites[familyID] = next
	if !deleted {
		return store.ErrNotFound
	}
	return nil
}

func (m *memoryRepo) SavePromptDebug(r *http.Request, entry domain.PromptDebugEntry) error {
	entry.CreatedAt = time.Now()
	familyID := m.familyID(mustUserID(r.Context()))
	m.prompts[familyID] = append([]domain.PromptDebugEntry{entry}, m.prompts[familyID]...)
	return nil
}

func (m *memoryRepo) LatestPromptDebug(r *http.Request) (domain.PromptDebugEntry, error) {
	entries := m.prompts[m.familyID(mustUserID(r.Context()))]
	if len(entries) == 0 {
		return domain.PromptDebugEntry{}, store.ErrNotFound
	}
	return entries[0], nil
}

func (m *memoryRepo) ListPromptDebug(r *http.Request, limit int) ([]domain.PromptDebugEntry, error) {
	entries := append([]domain.PromptDebugEntry(nil), m.prompts[m.familyID(mustUserID(r.Context()))]...)
	if len(entries) == 0 {
		return nil, store.ErrNotFound
	}
	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}
	return entries, nil
}

func (m *memoryRepo) ListPremiumUsers(_ *http.Request) ([]domain.PremiumUser, error) {
	out := make([]domain.PremiumUser, 0, len(m.premiumUsers))
	for _, premiumUser := range m.premiumUsers {
		out = append(out, premiumUser)
	}
	return out, nil
}

func (m *memoryRepo) SavePremiumUser(_ *http.Request, email string, _ string) (domain.PremiumUser, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if normalizedEmail == "markush1986@gmail.com" {
		return domain.PremiumUser{}, store.ErrAlreadyPremium
	}
	for _, premiumUser := range m.premiumUsers {
		if strings.EqualFold(strings.TrimSpace(premiumUser.Email), normalizedEmail) {
			return domain.PremiumUser{}, store.ErrAlreadyPremium
		}
	}
	if userID, ok := m.userIDByEmail(normalizedEmail); ok {
		allowed, _ := m.IsPremiumUser(nil, userID)
		if allowed {
			return domain.PremiumUser{}, store.ErrAlreadyPremium
		}
	}
	id := "premium-" + strings.ReplaceAll(normalizedEmail, "@", "-")
	user := domain.PremiumUser{ID: id, Email: normalizedEmail, CreatedAt: time.Now()}
	m.premiumUsers[id] = user
	return user, nil
}

func (m *memoryRepo) DeletePremiumUser(_ *http.Request, id string) error {
	if _, ok := m.premiumUsers[id]; !ok {
		return store.ErrNotFound
	}
	delete(m.premiumUsers, id)
	return nil
}

func (m *memoryRepo) ListPremiumInvites(_ *http.Request, limit int) ([]domain.PremiumInvite, error) {
	if limit <= 0 || limit > len(m.premiumInvites) {
		limit = len(m.premiumInvites)
	}
	out := make([]domain.PremiumInvite, limit)
	copy(out, m.premiumInvites[:limit])
	return out, nil
}

func (m *memoryRepo) CreatePremiumInvite(_ *http.Request, email string, _ string) (domain.PremiumInvite, error) {
	invite := domain.PremiumInvite{
		ID:        "premium-invite-" + strconv.Itoa(len(m.premiumInvites)+1),
		Email:     strings.ToLower(strings.TrimSpace(email)),
		EmailSent: true,
		CreatedAt: time.Now(),
	}
	m.premiumInvites = append([]domain.PremiumInvite{invite}, m.premiumInvites...)
	return invite, nil
}

func (m *memoryRepo) ListMailTemplates(_ *http.Request) ([]domain.MailTemplate, error) {
	items := make([]domain.MailTemplate, 0, len(mailer.DefaultTemplateKinds()))
	for _, kind := range mailer.DefaultTemplateKinds() {
		defaults, _ := mailer.DefaultTemplate(kind)
		item := domain.MailTemplate{
			Kind:         kind,
			Subject:      defaults.Subject,
			TextBody:     defaults.TextBody,
			HTMLBody:     defaults.HTMLBody,
			Description:  defaults.Description,
			VariableHint: append([]string(nil), defaults.Variables...),
		}
		if saved, ok := m.mailTemplates[kind]; ok {
			item.Subject = saved.Subject
			item.TextBody = saved.TextBody
			item.HTMLBody = saved.HTMLBody
			item.UpdatedAt = saved.UpdatedAt
		}
		items = append(items, item)
	}
	return items, nil
}

func (m *memoryRepo) SaveMailTemplate(_ *http.Request, kind string, update domain.UpdateMailTemplateRequest) (domain.MailTemplate, error) {
	defaults, ok := mailer.DefaultTemplate(kind)
	if !ok {
		return domain.MailTemplate{}, store.ErrNotFound
	}
	item := domain.MailTemplate{
		Kind:         kind,
		Subject:      strings.TrimSpace(update.Subject),
		TextBody:     strings.TrimSpace(update.TextBody),
		HTMLBody:     strings.TrimSpace(update.HTMLBody),
		Description:  defaults.Description,
		VariableHint: append([]string(nil), defaults.Variables...),
		UpdatedAt:    time.Now(),
	}
	m.mailTemplates[kind] = item
	return item, nil
}

func (m *memoryRepo) SaveFeedback(r *http.Request, message string, page string) (domain.FeedbackEntry, error) {
	entry := domain.FeedbackEntry{
		ID:        "feedback-" + strconv.Itoa(len(m.feedback)+1),
		Message:   strings.TrimSpace(message),
		Page:      strings.TrimSpace(page),
		Status:    "open",
		CreatedAt: time.Now(),
	}
	m.feedback = append([]domain.FeedbackEntry{entry}, m.feedback...)
	return entry, nil
}

func (m *memoryRepo) ListFeedback(_ *http.Request, status string, limit int) ([]domain.FeedbackEntry, error) {
	filtered := make([]domain.FeedbackEntry, 0, len(m.feedback))
	for _, entry := range m.feedback {
		if strings.EqualFold(entry.Status, status) {
			filtered = append(filtered, entry)
		}
	}
	if len(filtered) == 0 {
		return nil, store.ErrNotFound
	}
	if limit <= 0 || limit > len(filtered) {
		limit = len(filtered)
	}
	out := make([]domain.FeedbackEntry, limit)
	copy(out, filtered[:limit])
	return out, nil
}

func (m *memoryRepo) ResolveFeedback(r *http.Request, feedbackID string) (domain.FeedbackEntry, error) {
	for index, entry := range m.feedback {
		if entry.ID != feedbackID {
			continue
		}
		if entry.Status == "resolved" {
			return domain.FeedbackEntry{}, store.ErrNotFound
		}
		entry.Status = "resolved"
		entry.ResolvedAt = time.Now()
		entry.ResolvedByUserID = mustUserID(r.Context())
		m.feedback[index] = entry
		return entry, nil
	}
	return domain.FeedbackEntry{}, store.ErrNotFound
}

func (m *memoryRepo) AdminStats(_ *http.Request) (domain.AdminStats, error) {
	return domain.AdminStats{
		AverageActiveAccountsPerFamily: 1.5,
		AverageProfileMembersPerFamily: 2.5,
		FamilyDistributionByAccounts: []domain.StatsBucket{
			{Label: "1", Count: 1},
			{Label: "2", Count: 2},
			{Label: "3", Count: 0},
			{Label: "4+", Count: 0},
		},
		FamilyDistributionByMembers: []domain.StatsBucket{
			{Label: "1", Count: 0},
			{Label: "2", Count: 1},
			{Label: "3", Count: 1},
			{Label: "4+", Count: 0},
		},
		Generations: []domain.GenerationCount{
			{Category: "weekly_cron", Count: m.generation["weekly_cron"]},
			{Category: "regenerate_dinner", Count: m.generation["regenerate_dinner"]},
		},
	}, nil
}

func (m *memoryRepo) RecordGenerationEvent(_ *http.Request, category string) error {
	m.generation[category]++
	return nil
}

func (m *memoryRepo) familyID(userID string) string {
	m.ensureFamily(userID)
	return m.activeFamilies[userID]
}

func (m *memoryRepo) userIDByEmailHash(emailHash string) (string, bool) {
	emailHash = strings.TrimSpace(emailHash)
	if emailHash == "" {
		return "", false
	}
	for userID, hash := range m.emailHashes {
		if hash == emailHash {
			return userID, true
		}
	}
	return "", false
}

func (m *memoryRepo) userIDByEmail(email string) (string, bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", false
	}
	for userID, current := range m.emails {
		if strings.EqualFold(strings.TrimSpace(current), email) {
			return userID, true
		}
	}
	return "", false
}

func (m *memoryRepo) accountSettingsOrDefault(userID string) domain.AccountSettings {
	settings, ok := m.accountSettings[userID]
	if !ok {
		return domain.AccountSettings{WeeklyPlanEmailEnabled: true, RecipeEmailEnabled: true}
	}
	return settings
}

func (m *memoryRepo) ensureFamily(userID string) {
	if m.activeFamilies[userID] == "" {
		m.activeFamilies[userID] = "family-" + userID
	}
	familyID := m.activeFamilies[userID]
	if m.familyMembers[familyID] == nil {
		m.familyMembers[familyID] = map[string]memoryFamilyMember{}
	}
	if _, exists := m.familyMembers[familyID][userID]; exists {
		return
	}
	role := "member"
	if len(m.familyMembers[familyID]) == 0 {
		role = "owner"
	}
	m.familyMembers[familyID][userID] = memoryFamilyMember{role: role}
}

func (m *memoryRepo) isPersonalFamily(userID string) bool {
	familyID := m.familyID(userID)
	members := m.familyMembers[familyID]
	if len(members) != 1 {
		return false
	}
	membership, ok := members[userID]
	return ok && membership.role == "owner"
}

func (m *memoryRepo) GetPlanByID(_ *http.Request, id string) (domain.Plan, error) {
	for key, plan := range m.plans {
		if strings.HasSuffix(key, "|"+id) {
			return plan, nil
		}
	}
	return domain.Plan{}, store.ErrNotFound
}

func TestCreatePlanAndShoppingList(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["user-1"] = domain.DefaultProfile()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	body := bytes.NewBufferString(`{"weekStart":"2026-04-20"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/plans", body)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var plan domain.Plan
	if err := json.Unmarshal(rec.Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if len(plan.Days) != 7 {
		t.Fatalf("expected seven days, got %d", len(plan.Days))
	}

	req = httptest.NewRequest(http.MethodGet, "/api/plans/"+plan.ID+"/shopping-list", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestSessionRequired(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAdminOverviewRequiresAdminEmail(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/overview", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAdminOverviewListsPremiumUsersAndStats(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	repo.premiumUsers["premium-anna"] = domain.PremiumUser{ID: "premium-anna", Email: "anna@example.test", CreatedAt: time.Now()}
	repo.feedback = []domain.FeedbackEntry{
		{ID: "feedback-1", Message: "Die Profilnavigation ist zu versteckt.", Page: "/onboarding", Status: "open", CreatedAt: time.Now()},
		{ID: "feedback-2", Message: "Bereits erledigt.", Page: "/admin", Status: "resolved", CreatedAt: time.Now(), ResolvedAt: time.Now(), ResolvedByUserID: "user-1"},
	}
	repo.generation["weekly_cron"] = 3
	repo.generation["regenerate_dinner"] = 5
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/overview?includeResolved=true", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, "anna@example.test") || !strings.Contains(body, `"averageActiveAccountsPerFamily":1.5`) || !strings.Contains(body, `"weekly_cron"`) || !strings.Contains(body, "Die Profilnavigation ist zu versteckt.") || !strings.Contains(body, "Bereits erledigt.") {
		t.Fatalf("unexpected admin overview: %s", body)
	}
}

func TestAdminCanResolveFeedback(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	repo.feedback = []domain.FeedbackEntry{{ID: "feedback-1", Message: "Bitte Mobile verdichten.", Page: "/", Status: "open", CreatedAt: time.Now()}}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/feedback/feedback-1/resolve", nil)
	req.SetPathValue("feedbackID", "feedback-1")
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"status":"resolved"`) {
		t.Fatalf("expected resolved status, got %s", rec.Body.String())
	}
	openFeedback, err := repo.ListFeedback(req, "open", 50)
	if !errors.Is(err, store.ErrNotFound) && len(openFeedback) > 0 {
		t.Fatalf("expected no open feedback left, got %#v", openFeedback)
	}
	resolvedFeedback, err := repo.ListFeedback(req, "resolved", 50)
	if err != nil || len(resolvedFeedback) != 1 {
		t.Fatalf("expected resolved feedback entry, got %#v err=%v", resolvedFeedback, err)
	}
}

func TestAccountSettingsRoundtrip(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/account-settings", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"recipeEmailEnabled":true`) {
		t.Fatalf("expected default settings, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPut, "/api/account-settings", bytes.NewBufferString(`{"recipeEmailEnabled":false}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"recipeEmailEnabled":false`) {
		t.Fatalf("expected updated settings, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAdminCanUpdateMailTemplate(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPut, "/api/admin/mail-templates/premium_invite", bytes.NewBufferString(`{"subject":"Premium {{app_url}}","textBody":"Text {{support_email}}","htmlBody":"<p>{{app_url}}</p>"}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"kind":"premium_invite"`) {
		t.Fatalf("expected saved template, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/admin/mail-templates", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `Premium {{app_url}}`) {
		t.Fatalf("expected updated template list, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAdminPremiumInviteCreatesGrantAndSendsMail(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/premium-users", bytes.NewBufferString(`{"email":"anna@example.test","sendInvite":true}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mailerSpy.premium) != 1 || mailerSpy.premium[0].To != "anna@example.test" {
		t.Fatalf("expected premium invite mail, got %+v", mailerSpy.premium)
	}
	if len(repo.premiumUsers) != 1 || !strings.Contains(rec.Body.String(), `"emailSent":true`) {
		t.Fatalf("expected premium grant with mail response, users=%+v body=%s", repo.premiumUsers, rec.Body.String())
	}
}

func TestAdminPremiumInviteRejectsExistingPremiumUser(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	repo.premiumUsers["premium-anna-example.test"] = domain.PremiumUser{
		ID:        "premium-anna-example.test",
		Email:     "anna@example.test",
		CreatedAt: time.Now().Add(-time.Hour),
	}
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/premium-users", bytes.NewBufferString(`{"email":"anna@example.test","sendInvite":true}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "bereits Premium-Zugriff") {
		t.Fatalf("expected premium conflict message, got %s", rec.Body.String())
	}
	if len(mailerSpy.premium) != 0 {
		t.Fatalf("expected no premium invite mail on conflict, got %+v", mailerSpy.premium)
	}
}

func TestBringExport(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{
		ID:        "plan-1",
		WeekStart: "2026-04-20",
		Days: []domain.DayPlan{{
			Date: "2026-04-20",
			Meals: []domain.Meal{{
				ID:    "meal-1",
				Title: "Pasta",
				Ingredients: []domain.Ingredient{
					{Name: "Zucchini", Amount: 1, Unit: "Stk", Category: "Gemuese"},
					{Name: "Zucchini", Amount: 1, Unit: "Stk", Category: "Gemuese"},
					{Name: "Pasta", Amount: 400, Unit: "g", Category: "Vorrat"},
				},
			}},
		}},
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Fatalf("expected text/html content type, got %q", contentType)
	}
	body := rec.Body.String()
	for _, expected := range []string{"schema.org", `"@type":"Recipe"`, "recipeIngredient", `"author":"Mahlio"`, `"prepTime":"PT10M"`, `"totalTime":"PT10M"`, "itemprop=\"recipeIngredient ingredients\"", "itemprop=\"author\"", "itemprop=\"recipeInstructions\"", "platform.getbring.com/widgets/import.js", "data-bring-import", "2 Stk Zucchini", "400 g Pasta"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("bring export missing %q in body: %s", expected, body)
		}
	}
	if !strings.Contains(body, `itemtype="https://schema.org/Recipe"`) && !strings.Contains(body, `itemtype="http://schema.org/Recipe"`) {
		t.Fatalf("bring export missing recipe itemtype in body: %s", body)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url", nil)
	req.Host = "mealplanner.test"
	req.Header.Set("X-Forwarded-Proto", "https")
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed url 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload["url"], "https://enjoy.getbring.com/") {
		t.Fatalf("unexpected signed url %q", payload["url"])
	}
	if !strings.HasPrefix(payload["pageUrl"], "https://mealplanner.test/api/plans/plan-1/bring-export?token=") {
		t.Fatalf("unexpected signed page url %q", payload["pageUrl"])
	}

	req = httptest.NewRequest(http.MethodGet, payload["pageUrl"], nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected public signed export 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestBringExportPrefersStoredShoppingListForWeek(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{
		ID:        "plan-1",
		WeekStart: "2026-04-20",
		ShoppingList: []domain.ShoppingItem{
			{Name: "Direkte Liste", Amount: 2, Unit: "Stk"},
		},
		Days: []domain.DayPlan{{Date: "2026-04-20", Meals: []domain.Meal{{ID: "meal-1", Title: "Pasta", Ingredients: []domain.Ingredient{{Name: "Nicht nutzen", Amount: 1}}}}}},
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	body := rec.Body.String()
	if rec.Code != http.StatusOK || !strings.Contains(body, "2 Stk Direkte Liste") || strings.Contains(body, "Nicht nutzen") {
		t.Fatalf("expected stored shopping list to be used, status=%d body=%s", rec.Code, body)
	}
}

func TestBringExportCanExcludeCheckedWeekItems(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{
		ID:        "plan-1",
		WeekStart: "2026-04-20",
		ShoppingList: []domain.ShoppingItem{
			{Name: "Zucchini", Amount: 2, Unit: "Stk"},
			{Name: "Pasta", Amount: 400, Unit: "g"},
		},
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url?exclude=Zucchini", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed url 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(payload["pageUrl"], "exclude=Zucchini") {
		t.Fatalf("expected exclude query to be signed into page url, got %q", payload["pageUrl"])
	}

	req = httptest.NewRequest(http.MethodGet, payload["pageUrl"], nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed export 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if strings.Contains(body, "2 Stk Zucchini") || !strings.Contains(body, "400 g Pasta") {
		t.Fatalf("expected checked item to be excluded from Bring export, got %s", body)
	}
}

func TestBringExportCanScopeWeekDayAndMeal(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{
		ID:        "plan-1",
		WeekStart: "2026-04-20",
		Days: []domain.DayPlan{
			{
				Date:  "2026-04-20",
				Label: "Mo",
				Meals: []domain.Meal{
					{ID: "meal-1", Slot: "dinner", Title: "Pasta", Description: "Sahnig und mild.", Instructions: []string{"Wasser kochen", "Pasta garen", "Sauce unterheben"}, Ingredients: []domain.Ingredient{{Name: "Pasta", Amount: 400, Unit: "g"}}},
					{ID: "meal-2", Slot: "lunch", Title: "Salat", Ingredients: []domain.Ingredient{{Name: "Gurke", Amount: 1, Unit: "Stk"}}},
				},
			},
			{
				Date:  "2026-04-21",
				Label: "Di",
				Meals: []domain.Meal{
					{ID: "meal-3", Slot: "dinner", Title: "Curry", Ingredients: []domain.Ingredient{{Name: "Reis", Amount: 300, Unit: "g"}}},
				},
			},
		},
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url?day=2026-04-20&meal=meal-1", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed meal url 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload["url"], "https://enjoy.getbring.com/") || !strings.Contains(payload["url"], "deep_link_value=") {
		t.Fatalf("expected direct Bring link, got %q", payload["url"])
	}
	if !strings.Contains(payload["pageUrl"], "day=2026-04-20") || !strings.Contains(payload["pageUrl"], "meal=meal-1") || !strings.Contains(payload["pageUrl"], "token=") {
		t.Fatalf("expected scoped signed url, got %q", payload["url"])
	}

	req = httptest.NewRequest(http.MethodGet, payload["pageUrl"], nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed meal export 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, expected := range []string{"Pasta", "400 g Pasta", "Mahlio Rezept: Pasta", "itemprop=\"yield\"", "itemprop=\"recipeIngredient ingredients\"", "Wasser kochen", "\"image\":\"data:image/svg+xml;utf8,"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("meal export missing %q in body: %s", expected, body)
		}
	}
	for _, unexpected := range []string{"Gurke", "Reis"} {
		if strings.Contains(body, unexpected) {
			t.Fatalf("meal export included %q unexpectedly: %s", unexpected, body)
		}
	}

	req = httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url?day=2026-04-20", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed day url 200, got %d: %s", rec.Code, rec.Body.String())
	}
	payload = map[string]string{}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	req = httptest.NewRequest(http.MethodGet, payload["pageUrl"], nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected signed day export 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body = rec.Body.String()
	if !strings.Contains(body, "400 g Pasta") || !strings.Contains(body, "1 Stk Gurke") || strings.Contains(body, "300 g Reis") {
		t.Fatalf("day export did not contain only selected day ingredients: %s", body)
	}
}

func TestBringExportKeepsExistingWeekTokensValid(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{ID: "plan-1", WeekStart: "2026-04-20"}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)

	mac := hmac.New(sha256.New, []byte("test-secret"))
	mac.Write([]byte("bring-export:"))
	mac.Write([]byte("plan-1"))
	oldToken := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export?token="+url.QueryEscape(oldToken), nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected legacy week token to stay valid, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestBringExportPlanNotFound(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/plans/missing/bring-export", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	req = httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "mealplanner_http_requests_total") {
		t.Fatalf("metrics output missing request counter: %s", rec.Body.String())
	}
}

func TestMutatingRequestRequiresCSRF(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewBufferString(`{}`))
	repo.sessions["session-user-1"] = memorySession{userID: "user-1", csrf: "csrf-user-1", expiresAt: time.Now().Add(time.Hour)}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: "session-user-1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestCORSAllowsCSRFCredentials(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", []string{"http://localhost:4173"}, nil, nil)
	req := httptest.NewRequest(http.MethodOptions, "/api/profile", nil)
	req.Header.Set("Origin", "http://localhost:4173")
	req.Header.Set("Access-Control-Request-Method", "PUT")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type, X-CSRF-Token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("expected credentials true, got %q", got)
	}
	if headers := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(headers, "X-CSRF-Token") {
		t.Fatalf("expected csrf header to be allowed, got %q", headers)
	}
}

func TestCORSRejectsWildcardForCredentialedRequests(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", []string{"*"}, nil, nil)
	req := httptest.NewRequest(http.MethodOptions, "/api/profile", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected wildcard CORS to be ignored for credentials, got %q", got)
	}
}

func TestSecurityHeadersAndJSONBodyLimit(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodPut, "/api/profile", strings.NewReader(strings.Repeat("x", maxJSONBodyBytes+1)))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for oversized json body, got %d", rec.Code)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected nosniff header, got %q", got)
	}
}

func TestInternalWeeklyPlanUsesAPISecret(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["user-1"] = domain.DefaultProfile()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.emails["user-1"] = "anna@example.test"
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without internal secret, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 with internal secret, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"users":1`) || !strings.Contains(rec.Body.String(), `"emailsSent":1`) {
		t.Fatalf("unexpected weekly response: %s", rec.Body.String())
	}
	if len(mailerSpy.weekly) != 1 || mailerSpy.weekly[0].To != "anna@example.test" {
		t.Fatalf("expected weekly email to be sent once, got %+v", mailerSpy.weekly)
	}
}

func TestFavoritesAPIStoresAndDeletesPerFamily(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	meal := domain.Meal{ID: "meal-1", Slot: "dinner", Title: "Lieblingspasta", Description: "Schnell"}
	raw, _ := json.Marshal(domain.CreateFavoriteRequest{Meal: meal})

	req := httptest.NewRequest(http.MethodPost, "/api/favorites", bytes.NewReader(raw))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/favorites", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Lieblingspasta") {
		t.Fatalf("expected user favorite, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/favorites", nil)
	setAuth(repo, req, "user-2")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), "Lieblingspasta") {
		t.Fatalf("expected favorites to be family scoped, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/favorites/favorite-meal-1", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestFamilyInviteMergesProfileOnlyWithMatchingEmailHash(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.Profile{HouseholdName: "Familie A", Members: []domain.Member{{ID: "a", Name: "A"}}, Defaults: domain.MealDefaults{}, Presets: []string{"schnell"}}
	repo.profiles["family-user-2"] = domain.Profile{HouseholdName: "Familie B", Members: []domain.Member{{ID: "b", Name: "B"}}, Defaults: domain.MealDefaults{}, Presets: []string{"gemuese"}}
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-2"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
	}
	repo.familyMembers["family-user-2"] = map[string]memoryFamilyMember{
		"user-2": {role: "owner"},
	}
	if !repo.isPersonalFamily("user-2") {
		t.Fatalf("expected user-2 to start as personal family, got %+v", repo.familyMembers["family-user-2"])
	}
	authService := testAuth()
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), authService, "", nil, nil, mailerSpy)
	email := "person@example.test"
	emailHash := authService.Hash("email:" + email)
	repo.emailHashes["user-2"] = emailHash

	req := httptest.NewRequest(http.MethodPost, "/api/family/invites", bytes.NewBufferString(`{"email":"`+email+`"}`))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected invite 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), email) || !strings.Contains(rec.Body.String(), "persönlicher Account") {
		t.Fatalf("invite should not echo raw email and should include warning: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"emailSent":true`) {
		t.Fatalf("expected emailSent in invite response, got %s", rec.Body.String())
	}
	if len(mailerSpy.invites) != 1 || mailerSpy.invites[0].To != email {
		t.Fatalf("expected invite email to be sent, got %+v", mailerSpy.invites)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/family/invites/accept", bytes.NewBufferString(`{"token":"invite-token"}`))
	setAuth(repo, req, "user-2")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected accept 200, got %d: %s", rec.Code, rec.Body.String())
	}
	merged := repo.profiles["family-user-1"]
	if len(merged.Members) != 2 || repo.activeFamilies["user-2"] != "family-user-1" {
		t.Fatalf("expected merged profile and active family switch, profile=%+v active=%s", merged, repo.activeFamilies["user-2"])
	}
	req = httptest.NewRequest(http.MethodGet, "/api/family", nil)
	setAuth(repo, req, "user-2")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"id":"a","name":"A"`) || !strings.Contains(rec.Body.String(), `"id":"b","name":"B"`) {
		t.Fatalf("expected merged family members in summary, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateFamilyInviteRejectsAccountFromDifferentFamily(t *testing.T) {
	repo := newMemoryRepo()
	authService := testAuth()
	handler := New(repo, planner.New(provider.NewMockGenerator()), authService, "", nil, nil, nil)
	email := "person@example.test"
	repo.emailHashes["user-2"] = authService.Hash("email:" + email)
	repo.activeFamilies["user-2"] = "family-user-2"
	repo.familyMembers["family-user-2"] = map[string]memoryFamilyMember{
		"user-2": {role: "owner"},
		"user-3": {role: "member"},
	}

	req := httptest.NewRequest(http.MethodPost, "/api/family/invites", bytes.NewBufferString(`{"email":"`+email+`"}`))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "bereits zu einem anderen Familienkonto") {
		t.Fatalf("expected family conflict message, got %s", rec.Body.String())
	}
}

func TestAcceptFamilyInviteRejectsAccountFromDifferentFamily(t *testing.T) {
	repo := newMemoryRepo()
	authService := testAuth()
	handler := New(repo, planner.New(provider.NewMockGenerator()), authService, "", nil, nil, nil)
	email := "person@example.test"
	emailHash := authService.Hash("email:" + email)
	repo.emailHashes["user-2"] = emailHash
	repo.activeFamilies["user-2"] = "family-user-2"
	repo.familyMembers["family-user-2"] = map[string]memoryFamilyMember{
		"user-2": {role: "owner"},
		"user-3": {role: "member"},
	}
	repo.invites["invite-token"] = memoryInvite{
		targetFamilyID: "family-user-1",
		emailHash:      emailHash,
		token:          "invite-token",
		expiresAt:      time.Now().Add(time.Hour),
	}

	req := httptest.NewRequest(http.MethodPost, "/api/family/invites/accept", bytes.NewBufferString(`{"token":"invite-token"}`))
	setAuth(repo, req, "user-2")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "bereits zu einem anderen Familienkonto") {
		t.Fatalf("expected family conflict message, got %s", rec.Body.String())
	}
}

func TestCreateFamilyInviteStillSucceedsWhenEmailDeliveryFails(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.Profile{HouseholdName: "Familie A", Members: []domain.Member{{ID: "a", Name: "A"}}, Defaults: domain.MealDefaults{}, Presets: []string{"schnell"}}
	mailerSpy := &spyMailer{err: context.DeadlineExceeded}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/family/invites", bytes.NewBufferString(`{"email":"person@example.test"}`))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected invite 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), `"emailSent":true`) {
		t.Fatalf("expected invite response without emailSent=true on mail failure, got %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `invite-token`) {
		t.Fatalf("expected invite link to still be returned, got %s", rec.Body.String())
	}
	if len(mailerSpy.invites) != 1 || mailerSpy.invites[0].To != "person@example.test" {
		t.Fatalf("expected invite email attempt to be recorded, got %+v", mailerSpy.invites)
	}
}

func TestWeeklyPlanSendsToAllFamilyAccountsWithEmail(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.DefaultProfile()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-1"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
		"user-2": {role: "member"},
	}
	repo.emails["user-1"] = "anna@example.test"
	repo.emails["user-2"] = "ben@example.test"
	repo.sessions["session-user-1"] = memorySession{userID: "user-1", csrf: "csrf-user-1", expiresAt: time.Now().Add(time.Hour)}
	repo.sessions["session-user-2"] = memorySession{userID: "user-2", csrf: "csrf-user-2", expiresAt: time.Now().Add(time.Hour)}
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mailerSpy.weekly) != 2 {
		t.Fatalf("expected two weekly emails, got %+v", mailerSpy.weekly)
	}
	if !strings.Contains(rec.Body.String(), `"emailsSent":2`) {
		t.Fatalf("expected email metrics in response, got %s", rec.Body.String())
	}
}

func TestWeeklyPlanSkipsOptedOutAccounts(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.DefaultProfile()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-1"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
		"user-2": {role: "member"},
	}
	repo.emails["user-1"] = "anna@example.test"
	repo.emails["user-2"] = "ben@example.test"
	repo.accountSettings["user-2"] = domain.AccountSettings{WeeklyPlanEmailEnabled: false, RecipeEmailEnabled: false}
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mailerSpy.weekly) != 1 || mailerSpy.weekly[0].To != "anna@example.test" {
		t.Fatalf("expected opted-out account to be skipped, got %+v", mailerSpy.weekly)
	}
}

func TestWeeklyPlanDeduplicatesEmailsPerFamily(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.DefaultProfile()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-1"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
		"user-2": {role: "member"},
	}
	repo.emails["user-1"] = "anna@example.test"
	repo.emails["user-2"] = "Anna@Example.Test"
	mailerSpy := &spyMailer{}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mailerSpy.weekly) != 1 {
		t.Fatalf("expected duplicate family email to be sent once, got %+v", mailerSpy.weekly)
	}
	if !strings.Contains(rec.Body.String(), `"emailsSent":1`) {
		t.Fatalf("expected one email sent in response, got %s", rec.Body.String())
	}
}

func TestWeeklyPlanReportsEmailFailuresPerRecipient(t *testing.T) {
	repo := newMemoryRepo()
	repo.profiles["family-user-1"] = domain.DefaultProfile()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-1"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
		"user-2": {role: "member"},
	}
	repo.emails["user-1"] = "anna@example.test"
	repo.emails["user-2"] = "ben@example.test"
	mailerSpy := &spyMailer{
		weeklyErrFor: map[string]error{
			"ben@example.test": context.DeadlineExceeded,
		},
	}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "internal-secret", nil, nil, mailerSpy)

	req := httptest.NewRequest(http.MethodPost, "/api/internal/plans/weekly", nil)
	req.Header.Set("X-API-Secret", "internal-secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMultiStatus {
		t.Fatalf("expected 207 on partial email failure, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(mailerSpy.weekly) != 2 {
		t.Fatalf("expected both weekly email attempts to be recorded, got %+v", mailerSpy.weekly)
	}
	if !strings.Contains(rec.Body.String(), `"emailsSent":1`) || !strings.Contains(rec.Body.String(), `"emailFailures":[`) {
		t.Fatalf("expected partial email metrics in response, got %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"email":"ben@example.test"`) {
		t.Fatalf("expected failing recipient in response, got %s", rec.Body.String())
	}
}

func TestSessionIncludesPremiumFlag(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	repo.premiumUsers["premium-anna"] = domain.PremiumUser{ID: "premium-anna", Email: "anna@example.test", CreatedAt: time.Now()}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected session 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"isPremium":true`) {
		t.Fatalf("expected session to include premium flag, got %s", rec.Body.String())
	}
}

func TestSessionIncludesPremiumForFamilyMember(t *testing.T) {
	repo := newMemoryRepo()
	repo.activeFamilies["user-1"] = "family-user-1"
	repo.activeFamilies["user-2"] = "family-user-1"
	repo.familyMembers["family-user-1"] = map[string]memoryFamilyMember{
		"user-1": {role: "owner"},
		"user-2": {role: "member"},
	}
	repo.emails["user-1"] = "anna@example.test"
	repo.emails["user-2"] = "ben@example.test"
	repo.premiumUsers["premium-anna"] = domain.PremiumUser{ID: "premium-anna", Email: "anna@example.test", CreatedAt: time.Now()}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-2")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"isPremium":true`) {
		t.Fatalf("expected family-wide premium session, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSessionIncludesOnboardingRequiredForPlaceholderProfile(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"onboardingRequired":true`) {
		t.Fatalf("expected onboardingRequired for placeholder profile, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSessionOmitsOnboardingRequiredAfterSkip(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	repo.onboardingSeen["user-1"] = true
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"onboardingRequired":false`) {
		t.Fatalf("expected onboardingRequired false after skip, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSkipProfileOnboardingMarksAccount(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/account/onboarding/skip", nil)
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
	if !repo.onboardingSeen["user-1"] {
		t.Fatal("expected onboarding skip to be persisted")
	}
}

func TestCreateFeedbackRequiresPremiumUser(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "anna@example.test"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(`{"message":"Hallo"}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected feedback 403 for non premium user, got %d: %s", rec.Code, rec.Body.String())
	}

	repo.premiumUsers["premium-anna"] = domain.PremiumUser{ID: "premium-anna", Email: "anna@example.test", CreatedAt: time.Now()}
	req = httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(`{"message":"Hallo","page":"/"}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected feedback 201 for premium user, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"message":"Hallo"`) || !strings.Contains(rec.Body.String(), `"page":"/"`) {
		t.Fatalf("expected stored feedback in response, got %s", rec.Body.String())
	}
}

func TestCreateFeedbackAllowsAdminUser(t *testing.T) {
	repo := newMemoryRepo()
	repo.emails["user-1"] = "markush1986@gmail.com"
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(`{"message":"Admin-Hinweis","page":"/admin"}`))
	setAuth(repo, req, "user-1")
	req.Header.Set("X-CSRF-Token", "csrf-user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected feedback 201 for admin user, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"page":"/admin"`) {
		t.Fatalf("expected admin feedback page in response, got %s", rec.Body.String())
	}
}

func TestPromptDebugEndpointOnlyWhenEnabled(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/debug/prompts/latest", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected disabled debug 404, got %d", rec.Code)
	}

	t.Setenv("APP_ENV", "production")
	t.Setenv("PROMPT_DEBUG", "true")
	handler = New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req = httptest.NewRequest(http.MethodGet, "/api/debug/prompts/latest", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected production debug 404, got %d", rec.Code)
	}

	t.Setenv("APP_ENV", "test")
	handler = New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req = httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewBufferString(`{"weekStart":"2026-04-20"}`))
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected plan 201, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/debug/prompts/latest", nil)
	setAuth(repo, req, "user-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"latest"`) || !strings.Contains(rec.Body.String(), `"recent"`) || !strings.Contains(rec.Body.String(), "generate_week") || !strings.Contains(rec.Body.String(), "Familienprofil") || !strings.Contains(rec.Body.String(), `"members":"1"`) || !strings.Contains(rec.Body.String(), `"favorites":"0"`) {
		t.Fatalf("expected prompt debug entry, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAuthProvidersAreRateLimitedWhenConfigured(t *testing.T) {
	t.Setenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "1")
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/providers", nil)
	req.RemoteAddr = "203.0.113.10:4321"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected first request 200, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/auth/providers", nil)
	req.RemoteAddr = "203.0.113.10:4321"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests || !strings.Contains(rec.Body.String(), "Zu viele Anfragen") {
		t.Fatalf("expected rate limit 429, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestServerErrorIncludesRequestIDHeader(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)

	req := httptest.NewRequest(http.MethodPut, "/api/profile", bytes.NewBufferString(`{"householdName":"`))
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("X-Request-Id") == "" {
		t.Fatal("expected request id header")
	}
}

func TestSessionEndpoint(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"authenticated":true`) || !strings.Contains(rec.Body.String(), "csrf-user-1") {
		t.Fatalf("unexpected session response: %s", rec.Body.String())
	}
}

func TestAuthProvidersEndpoint(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), configuredTestAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/providers", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"id":"google"`) || !strings.Contains(rec.Body.String(), `"startUrl":"/api/auth/google/start"`) {
		t.Fatalf("unexpected providers response: %s", rec.Body.String())
	}
}

func TestGoogleStartRejectsGetRequests(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), configuredTestAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/start", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleStartSetsSecureStateCookie(t *testing.T) {
	handler := New(newMemoryRepo(), planner.New(provider.NewMockGenerator()), configuredTestAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google/start", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d: %s", rec.Code, rec.Body.String())
	}
	if location := rec.Header().Get("Location"); !strings.HasPrefix(location, "https://accounts.google.com/o/oauth2/v2/auth?") {
		t.Fatalf("unexpected google redirect location %q", location)
	}
	var stateCookie *http.Cookie
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == auth.StateCookieName {
			stateCookie = cookie
			break
		}
	}
	if stateCookie == nil {
		t.Fatal("expected oauth state cookie")
	}
	if !stateCookie.HttpOnly || !stateCookie.Secure || stateCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("state cookie is not hardened: %+v", stateCookie)
	}
}

func TestLogoutDeletesSessionAndClearsSecureCookie(t *testing.T) {
	repo := newMemoryRepo()
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "", nil, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, ok := repo.sessions["session-user-1"]; ok {
		t.Fatal("expected session to be deleted")
	}
	var sessionCookie *http.Cookie
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == auth.SessionCookieName {
			sessionCookie = cookie
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected cleared session cookie")
	}
	if sessionCookie.MaxAge != -1 || !sessionCookie.HttpOnly || !sessionCookie.Secure || sessionCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie is not cleared securely: %+v", sessionCookie)
	}
}

func TestBringExportURLUsesConfiguredBaseURL(t *testing.T) {
	repo := newMemoryRepo()
	repo.plans["user-1|plan-1"] = domain.Plan{ID: "plan-1", WeekStart: "2026-04-20"}
	handler := New(repo, planner.New(provider.NewMockGenerator()), testAuth(), "test-secret", nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/plans/plan-1/bring-export-url", nil)
	req.Host = "attacker.example"
	req.Header.Set("X-Forwarded-Host", "attacker.example")
	req.Header.Set("X-Forwarded-Proto", "http")
	setAuth(repo, req, "user-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(payload["pageUrl"], "https://mealplanner.test/api/plans/plan-1/bring-export?token=") {
		t.Fatalf("unexpected export url %q", payload["url"])
	}
	if strings.Contains(payload["pageUrl"], "attacker.example") || strings.Contains(payload["url"], "attacker.example") {
		t.Fatalf("export url trusted spoofed host: %q", payload["url"])
	}
}

func testAuth() auth.Service {
	return auth.NewService(auth.Config{
		BaseURL:       "https://mealplanner.test",
		SessionSecret: "test-secret",
	})
}

func configuredTestAuth() auth.Service {
	return auth.NewService(auth.Config{
		BaseURL:            "https://mealplanner.test",
		SessionSecret:      "test-secret",
		GoogleClientID:     "google-client",
		GoogleClientSecret: "google-secret",
	})
}

func setAuth(repo *memoryRepo, req *http.Request, userID string) {
	repo.sessions["session-"+userID] = memorySession{userID: userID, csrf: "csrf-" + userID, expiresAt: time.Now().Add(time.Hour)}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: "session-" + userID})
	req.Header.Set("X-CSRF-Token", "csrf-"+userID)
}
