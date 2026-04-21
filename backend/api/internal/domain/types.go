package domain

import (
	"errors"
	"strings"
	"time"
)

type Profile struct {
	HouseholdName string       `json:"householdName"`
	Members       []Member     `json:"members"`
	Defaults      MealDefaults `json:"defaults"`
	Presets       []string     `json:"presets"`
	Notes         string       `json:"notes"`
	UpdatedAt     time.Time    `json:"updatedAt,omitempty"`
}

type FamilyMemberSummary struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Alias string `json:"alias,omitempty"`
}

type FamilyAccount struct {
	UserID         string `json:"userId"`
	Email          string `json:"email,omitempty"`
	Role           string `json:"role,omitempty"`
	LinkedMemberID string `json:"linkedMemberId,omitempty"`
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
	ExpiresAt   time.Time `json:"expiresAt"`
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	AcceptedAt  time.Time `json:"acceptedAt,omitempty"`
	WarningText string    `json:"warningText,omitempty"`
}

type AcceptFamilyInviteRequest struct {
	Token string `json:"token"`
}

type UpdateFamilyMemberLinkRequest struct {
	AccountUserID string `json:"accountUserId"`
	MemberID      string `json:"memberId"`
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
		HouseholdName: "Familie Hartmann",
		Members: []Member{
			{ID: "markus", Name: "Markus", Role: "Erwachsener", CaloriesTarget: 2300, Likes: "abwechslungsreiche, frische Kueche", Dislikes: "langweilige Standardgerichte"},
		},
		Defaults: MealDefaults{
			Breakfast: "schnell, familientauglich, nicht zu suess",
			Lunch:     "alltagstauglich und gut vorzubereiten",
			Dinner:    "gemeinsames warmes Essen",
			Snacks:    "nur wenn sinnvoll fuer Kalorienziel oder Alltag",
		},
		Presets: []string{"familientauglich", "ausgewogen", "saisonal", "schnell unter der Woche"},
		Notes:   "Naehrwerte sind Schaetzungen und nicht medizinisch verbindlich.",
	}
}
