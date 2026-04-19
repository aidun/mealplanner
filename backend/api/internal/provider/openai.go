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

func (g OpenAIGenerator) GenerateWeek(ctx context.Context, profile domain.Profile, weekStart time.Time) (domain.Plan, error) {
	var plan domain.Plan
	if err := g.call(ctx, planner.WeekPrompt(profile, weekStart), planSchema(), &plan); err != nil {
		return domain.Plan{}, err
	}
	plan.WeekStart = weekStart.Format("2006-01-02")
	plan.Status = "planned"
	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()
	plan.ShoppingList = domain.ConsolidateShoppingList(plan)
	return plan, nil
}

func (g OpenAIGenerator) RegenerateMeal(ctx context.Context, profile domain.Profile, plan domain.Plan, mealID string, note string) (domain.Meal, error) {
	var meal domain.Meal
	if err := g.call(ctx, planner.RegeneratePrompt(profile, plan, mealID, note), mealSchema(), &meal); err != nil {
		return domain.Meal{}, err
	}
	meal.ID = mealID
	meal.RegenerationNote = note
	meal.EstimatedNutrition = true
	meal.GeneratedAt = time.Now()
	return meal, nil
}

func (g OpenAIGenerator) call(ctx context.Context, prompt string, schema map[string]any, target any) error {
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
		return fmt.Errorf("openai responses api failed: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	text, err := extractOutputText(respBody)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(text), target); err != nil {
		return fmt.Errorf("decode structured output: %w", err)
	}
	return nil
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

func stringSchema() map[string]any {
	return map[string]any{"type": "string"}
}

func numberSchema() map[string]any {
	return map[string]any{"type": "number"}
}
