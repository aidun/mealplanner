package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/domain"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
)

type OpenAIConfig struct {
	APIKey string
	Model  string
}

type OpenAIGenerator struct {
	apiKey string
	model  string
	client *http.Client
}

func NewOpenAIGenerator(cfg OpenAIConfig) (OpenAIGenerator, error) {
	apiKey := strings.TrimSpace(cfg.APIKey)
	if apiKey == "" || strings.HasPrefix(apiKey, "__set_") {
		return OpenAIGenerator{}, errors.New("OPENAI_API_KEY is required for live provider mode")
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "gpt-5.4-mini"
	}
	return OpenAIGenerator{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 90 * time.Second},
	}, nil
}

func (g OpenAIGenerator) GenerateWeek(ctx context.Context, profile domain.Profile, weekStart time.Time, favorites []domain.FavoriteRecipe) (domain.Plan, error) {
	var plan domain.Plan
	if err := g.call(ctx, "generate_week", planner.WeekPrompt(profile, weekStart, favorites), planSchema(), &plan); err != nil {
		return domain.Plan{}, err
	}
	plan.WeekStart = weekStart.Format("2006-01-02")
	plan.Status = "planned"
	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

func (g OpenAIGenerator) RegenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string, favorites []domain.FavoriteRecipe) (domain.Meal, error) {
	var meal domain.Meal
	if err := g.call(ctx, "regenerate_meal", planner.RegeneratePrompt(profile, plan, mealID, note, favorites), mealSchema(), &meal); err != nil {
		return domain.Meal{}, err
	}
	meal.ID = mealID
	meal.RegenerationNote = note
	meal.EstimatedNutrition = true
	meal.GeneratedAt = time.Now()
	return meal, nil
}

func (g OpenAIGenerator) MergeProfiles(ctx context.Context, target domain.Profile, incoming domain.Profile) (domain.Profile, error) {
	var profile domain.Profile
	if err := g.call(ctx, "merge_profile", planner.MergeProfilePrompt(target, incoming), profileSchema(), &profile); err != nil {
		return domain.Profile{}, err
	}
	profile.UpdatedAt = time.Now()
	return profile, nil
}

func (g OpenAIGenerator) call(ctx context.Context, operation string, prompt string, schema map[string]any, target any) error {
	start := time.Now()
	status := "error"
	defer func() {
		recordOpenAIRequest(operation, g.model, status, time.Since(start))
	}()

	payload := map[string]any{
		"model": g.model,
		"input": []map[string]string{
			{"role": "system", "content": "Du bist ein Familien-Ernaehrungsplaner. Antworte ausschliesslich als JSON nach Schema. Naehrwerte sind klare Schaetzungen."},
			{"role": "user", "content": prompt},
		},
		"text": map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "mealplanner_output",
				"strict": true,
				"schema": schema,
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/responses", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("openai responses api failed: status=%d body=%s", resp.StatusCode, sanitizeOpenAIErrorBody(respBody))
	}
	recordOpenAIUsage(operation, g.model, parseUsage(respBody))

	text, err := extractOutputText(respBody)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(text), target); err != nil {
		return fmt.Errorf("decode structured output: %w", err)
	}
	status = "success"
	return nil
}

func sanitizeOpenAIErrorBody(body []byte) string {
	const limit = 512
	text := strings.TrimSpace(string(body))
	if text == "" {
		return ""
	}
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\r", " ")
	for _, marker := range []string{"sk-", "sess-", "Bearer "} {
		if strings.Contains(text, marker) {
			return "[redacted]"
		}
	}
	if len(text) > limit {
		return text[:limit] + "...[truncated]"
	}
	return text
}

type openAIUsage struct {
	InputTokens     int
	OutputTokens    int
	ReasoningTokens int
	CachedTokens    int
	TotalTokens     int
}

func parseUsage(body []byte) openAIUsage {
	var parsed struct {
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
			TotalTokens  int `json:"total_tokens"`
			InputDetails struct {
				CachedTokens int `json:"cached_tokens"`
			} `json:"input_tokens_details"`
			OutputDetails struct {
				ReasoningTokens int `json:"reasoning_tokens"`
			} `json:"output_tokens_details"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return openAIUsage{}
	}
	return openAIUsage{
		InputTokens:     parsed.Usage.InputTokens,
		OutputTokens:    parsed.Usage.OutputTokens,
		ReasoningTokens: parsed.Usage.OutputDetails.ReasoningTokens,
		CachedTokens:    parsed.Usage.InputDetails.CachedTokens,
		TotalTokens:     parsed.Usage.TotalTokens,
	}
}

func extractOutputText(body []byte) (string, error) {
	var parsed struct {
		OutputText string `json:"output_text"`
		Output     []struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	if strings.TrimSpace(parsed.OutputText) != "" {
		return parsed.OutputText, nil
	}
	for _, item := range parsed.Output {
		for _, content := range item.Content {
			if strings.TrimSpace(content.Text) != "" {
				return content.Text, nil
			}
		}
	}
	return "", errors.New("openai response did not contain output text")
}

func planSchema() map[string]any {
	meal := mealSchema()
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"id", "weekStart", "status", "days"},
		"properties": map[string]any{
			"id":        stringSchema(),
			"weekStart": stringSchema(),
			"status":    stringSchema(),
			"days": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"date", "label", "meals"},
					"properties": map[string]any{
						"date":  stringSchema(),
						"label": stringSchema(),
						"meals": map[string]any{"type": "array", "items": meal},
					},
				},
			},
		},
	}
}

func mealSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"id", "slot", "title", "description", "servings", "ingredients", "instructions", "nutrition", "tags", "warnings", "estimatedNutrition"},
		"properties": map[string]any{
			"id":          stringSchema(),
			"slot":        stringSchema(),
			"title":       stringSchema(),
			"description": stringSchema(),
			"servings": map[string]any{"type": "array", "items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"memberId", "name", "portion", "factor"},
				"properties":           map[string]any{"memberId": stringSchema(), "name": stringSchema(), "portion": stringSchema(), "factor": numberSchema()},
			}},
			"ingredients": map[string]any{"type": "array", "items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"name", "amount", "unit", "category", "note"},
				"properties":           map[string]any{"name": stringSchema(), "amount": numberSchema(), "unit": stringSchema(), "category": stringSchema(), "note": stringSchema()},
			}},
			"instructions":       map[string]any{"type": "array", "items": stringSchema()},
			"nutrition":          nutritionSchema(),
			"tags":               map[string]any{"type": "array", "items": stringSchema()},
			"warnings":           map[string]any{"type": "array", "items": stringSchema()},
			"estimatedNutrition": map[string]any{"type": "boolean"},
		},
	}
}

func nutritionSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"calories", "proteinG", "carbsG", "fatG", "fiberG"},
		"properties": map[string]any{
			"calories": map[string]any{"type": "integer"},
			"proteinG": map[string]any{"type": "integer"},
			"carbsG":   map[string]any{"type": "integer"},
			"fatG":     map[string]any{"type": "integer"},
			"fiberG":   map[string]any{"type": "integer"},
		},
	}
}

func profileSchema() map[string]any {
	member := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"id", "name", "role", "age", "caloriesTarget", "presets", "likes", "dislikes", "restrictions"},
		"properties": map[string]any{
			"id":             stringSchema(),
			"name":           stringSchema(),
			"role":           stringSchema(),
			"age":            map[string]any{"type": "integer"},
			"caloriesTarget": map[string]any{"type": "integer"},
			"presets":        map[string]any{"type": "array", "items": stringSchema()},
			"likes":          stringSchema(),
			"dislikes":       stringSchema(),
			"restrictions":   stringSchema(),
		},
	}
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"householdName", "members", "defaults", "presets", "notes"},
		"properties": map[string]any{
			"householdName": stringSchema(),
			"members":       map[string]any{"type": "array", "items": member},
			"defaults": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"breakfast", "lunch", "dinner", "snacks"},
				"properties": map[string]any{
					"breakfast": stringSchema(),
					"lunch":     stringSchema(),
					"dinner":    stringSchema(),
					"snacks":    stringSchema(),
				},
			},
			"presets": map[string]any{"type": "array", "items": stringSchema()},
			"notes":   stringSchema(),
		},
	}
}

func stringSchema() map[string]any {
	return map[string]any{"type": "string"}
}

func numberSchema() map[string]any {
	return map[string]any{"type": "number"}
}
