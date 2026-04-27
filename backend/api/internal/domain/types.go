package domain

import (
	"errors"
	"strings"
	"time"
)

type Profile struct {
	HouseholdName   string       `json:"householdName"`
	Members         []Member     `json:"members"`
	Defaults        MealDefaults `json:"defaults"`
	Presets         []string     `json:"presets"`
	Notes           string       `json:"notes"`
	PreferredStores string       `json:"preferredStores,omitempty"`
	ShoppingNotes   string       `json:"shoppingNotes,omitempty"`
	UpdatedAt       time.Time    `json:"updatedAt,omitempty"`
}

type FamilyMemberSummary struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Alias string `json:"alias,omitempty"`
}

type FamilyAccount struct {
	UserID         string          `json:"userId"`
	Email          string          `json:"email,omitempty"`
	Role           string          `json:"role,omitempty"`
	LinkedMemberID string          `json:"linkedMemberId,omitempty"`
	Settings       AccountSettings `json:"settings"`
}

type FamilySummary struct {
	ID            string                `json:"id"`
	Name          string                `json:"name"`
	MemberCount   int                   `json:"memberCount"`
	Members       []FamilyMemberSummary `json:"members,omitempty"`
	Accounts      []FamilyAccount       `json:"accounts,omitempty"`
	Personal      bool                  `json:"personal"`
	CreatedAt     time.Time             `json:"createdAt,omitempty"`
	MergedWarning string                `json:"mergedWarning,omitempty"`
}

type CreateFamilyInviteRequest struct {
	Email string `json:"email"`
}

type FamilyInvite struct {
	ID          string    `json:"id"`
	InviteLink  string    `json:"inviteLink,omitempty"`
	EmailHash   string    `json:"emailHash,omitempty"`
	EmailSent   bool      `json:"emailSent"`
	ExpiresAt   time.Time `json:"expiresAt"`
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	AcceptedAt  time.Time `json:"acceptedAt,omitempty"`
	WarningText string    `json:"warningText,omitempty"`
}

type PremiumUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}

type PremiumInviteResult struct {
	PremiumUser PremiumUser `json:"premiumUser"`
	EmailSent   bool        `json:"emailSent"`
	InviteLink  string      `json:"inviteLink,omitempty"`
}

type PremiumInvite struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	EmailSent bool      `json:"emailSent"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}

type FeedbackEntry struct {
	ID               string    `json:"id"`
	Message          string    `json:"message"`
	Page             string    `json:"page,omitempty"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt,omitempty"`
	ResolvedAt       time.Time `json:"resolvedAt,omitempty"`
	ResolvedByUserID string    `json:"resolvedByUserId,omitempty"`
}

type CreateFeedbackRequest struct {
	Message string `json:"message"`
	Page    string `json:"page,omitempty"`
}

type CreatePremiumUserRequest struct {
	Email string `json:"email"`
}

type CreatePremiumInviteRequest struct {
	Email string `json:"email"`
}

type AccountSettings struct {
	WeeklyPlanEmailEnabled bool      `json:"weeklyPlanEmailEnabled"`
	RecipeEmailEnabled     bool      `json:"recipeEmailEnabled"`
	UpdatedAt              time.Time `json:"updatedAt,omitempty"`
}

type MailTemplate struct {
	Kind         string    `json:"kind"`
	Label        string    `json:"label,omitempty"`
	Subject      string    `json:"subject"`
	TextBody     string    `json:"textBody"`
	HTMLBody     string    `json:"htmlBody"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
	Description  string    `json:"description,omitempty"`
	VariableHint []string  `json:"variableHint,omitempty"`
}

type UpdateMailTemplateRequest struct {
	Subject  string `json:"subject"`
	TextBody string `json:"textBody"`
	HTMLBody string `json:"htmlBody"`
}

type StatsBucket struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type GenerationCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type AdminStats struct {
	AverageActiveAccountsPerFamily float64           `json:"averageActiveAccountsPerFamily"`
	AverageProfileMembersPerFamily float64           `json:"averageProfileMembersPerFamily"`
	FamilyDistributionByAccounts   []StatsBucket     `json:"familyDistributionByAccounts,omitempty"`
	FamilyDistributionByMembers    []StatsBucket     `json:"familyDistributionByMembers,omitempty"`
	Generations                    []GenerationCount `json:"generations,omitempty"`
}

type AdminOverview struct {
	PremiumUsers     []PremiumUser   `json:"premiumUsers,omitempty"`
	PremiumInvites   []PremiumInvite `json:"premiumInvites,omitempty"`
	Feedback         []FeedbackEntry `json:"feedback,omitempty"`
	ResolvedFeedback []FeedbackEntry `json:"resolvedFeedback,omitempty"`
	MailTemplates    []MailTemplate  `json:"mailTemplates,omitempty"`
	Stats            AdminStats      `json:"stats"`
}

type AcceptFamilyInviteRequest struct {
	Token string `json:"token"`
}

type UpdateFamilyMemberLinkRequest struct {
	AccountUserID string `json:"accountUserId"`
	MemberID      string `json:"memberId"`
}

type UpdateFamilyAccountSettingsRequest struct {
	AccountUserID string          `json:"accountUserId"`
	Settings      AccountSettings `json:"settings"`
}

type Member struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Alias          string   `json:"alias,omitempty"`
	Role           string   `json:"role,omitempty"`
	Age            int      `json:"age,omitempty"`
	CaloriesTarget int      `json:"caloriesTarget,omitempty"`
	Presets        []string `json:"presets,omitempty"`
	Likes          string   `json:"likes,omitempty"`
	Dislikes       string   `json:"dislikes,omitempty"`
	Restrictions   string   `json:"restrictions,omitempty"`
}

type MealDefaults struct {
	Breakfast string `json:"breakfast,omitempty"`
	Lunch     string `json:"lunch,omitempty"`
	Dinner    string `json:"dinner,omitempty"`
	Snacks    string `json:"snacks,omitempty"`
}

type Plan struct {
	ID           string         `json:"id"`
	WeekStart    string         `json:"weekStart"`
	Status       string         `json:"status"`
	Days         []DayPlan      `json:"days"`
	ShoppingList []ShoppingItem `json:"shoppingList,omitempty"`
	CreatedAt    time.Time      `json:"createdAt,omitempty"`
	UpdatedAt    time.Time      `json:"updatedAt,omitempty"`
}

type DayPlan struct {
	Date  string `json:"date"`
	Label string `json:"label"`
	Meals []Meal `json:"meals"`
}

type Meal struct {
	ID                 string            `json:"id"`
	Slot               string            `json:"slot"`
	Title              string            `json:"title"`
	Description        string            `json:"description"`
	Servings           []Serving         `json:"servings"`
	Ingredients        []Ingredient      `json:"ingredients"`
	Instructions       []string          `json:"instructions"`
	Nutrition          Nutrition         `json:"nutrition"`
	Tags               []string          `json:"tags"`
	Warnings           []string          `json:"warnings,omitempty"`
	EstimatedNutrition bool              `json:"estimatedNutrition"`
	RegenerationNote   string            `json:"regenerationNote,omitempty"`
	GeneratedAt        time.Time         `json:"generatedAt,omitempty"`
	Meta               map[string]string `json:"meta,omitempty"`
}

type FavoriteRecipe struct {
	ID        string    `json:"id"`
	Meal      Meal      `json:"meal"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}

type CreateFavoriteRequest struct {
	Meal Meal `json:"meal"`
}

type PromptDebugEntry struct {
	Operation string            `json:"operation"`
	Model     string            `json:"model,omitempty"`
	Prompt    string            `json:"prompt"`
	Meta      map[string]string `json:"meta,omitempty"`
	CreatedAt time.Time         `json:"createdAt,omitempty"`
}

type OpenAIRequestMetric struct {
	Operation   string  `json:"operation"`
	Model       string  `json:"model"`
	Status      string  `json:"status"`
	Count       uint64  `json:"count"`
	DurationSum float64 `json:"durationSum"`
}

type OpenAITokenMetric struct {
	Operation string `json:"operation"`
	Model     string `json:"model"`
	Type      string `json:"type"`
	Count     uint64 `json:"count"`
}

type PromptDebugSnapshot struct {
	Latest *PromptDebugEntry     `json:"latest,omitempty"`
	Recent []PromptDebugEntry    `json:"recent,omitempty"`
	OpenAI PromptDebugOpenAIData `json:"openai"`
}

type PromptDebugOpenAIData struct {
	Requests []OpenAIRequestMetric `json:"requests,omitempty"`
	Tokens   []OpenAITokenMetric   `json:"tokens,omitempty"`
}

type Serving struct {
	MemberID string  `json:"memberId"`
	Name     string  `json:"name"`
	Portion  string  `json:"portion"`
	Factor   float64 `json:"factor"`
}

type Ingredient struct {
	Name     string  `json:"name"`
	Amount   float64 `json:"amount,omitempty"`
	Unit     string  `json:"unit,omitempty"`
	Category string  `json:"category,omitempty"`
	Note     string  `json:"note,omitempty"`
}

type ShoppingItem struct {
	Name     string  `json:"name"`
	Amount   float64 `json:"amount,omitempty"`
	Unit     string  `json:"unit,omitempty"`
	Category string  `json:"category,omitempty"`
	Note     string  `json:"note,omitempty"`
}

type Nutrition struct {
	Calories int `json:"calories"`
	ProteinG int `json:"proteinG"`
	CarbsG   int `json:"carbsG"`
	FatG     int `json:"fatG"`
	FiberG   int `json:"fiberG,omitempty"`
}

type CreatePlanRequest struct {
	WeekStart string `json:"weekStart,omitempty"`
}

type RegenerateMealRequest struct {
	Note string `json:"note"`
}

func (p Profile) Validate() error {
	if strings.TrimSpace(p.HouseholdName) == "" {
		return errors.New("householdName is required")
	}
	if len(p.Members) == 0 {
		return errors.New("at least one member is required")
	}
	for _, member := range p.Members {
		if strings.TrimSpace(member.ID) == "" {
			return errors.New("member id is required")
		}
		if strings.TrimSpace(member.Name) == "" {
			return errors.New("member name is required")
		}
	}
	return nil
}

func DefaultProfile() Profile {
	return Profile{
		HouseholdName: "Privater Haushalt",
		Members: []Member{
			{ID: "person-1", Name: "Person 1", Alias: "Person 1", Role: "Erwachsen", CaloriesTarget: 2200},
		},
		Defaults: MealDefaults{
			Breakfast: "schnell, familientauglich, nicht zu süß",
			Lunch:     "alltagstauglich und gut vorzubereiten",
			Dinner:    "gemeinsames warmes Essen",
			Snacks:    "nur wenn sinnvoll für Kalorienziel oder Alltag",
		},
		Presets: []string{"familientauglich", "ausgewogen", "saisonal", "schnell unter der Woche"},
		Notes:   "Nährwerte sind Schätzungen und nicht medizinisch verbindlich.",
	}
}

func IsPlaceholderProfile(profile Profile) bool {
	if strings.TrimSpace(profile.HouseholdName) != "Privater Haushalt" {
		return false
	}
	if len(profile.Members) != 1 {
		return false
	}
	member := profile.Members[0]
	if strings.TrimSpace(member.ID) != "person-1" {
		return false
	}
	if strings.TrimSpace(member.Name) != "Person 1" {
		return false
	}
	if strings.TrimSpace(member.Alias) != "Person 1" {
		return false
	}
	return true
}
