package provider

import (
	"strings"
	"testing"
	"time"
)

func TestExtractOutputTextPrefersOutputText(t *testing.T) {
	text, err := extractOutputText([]byte(`{"output_text":"{\"id\":\"x\"}"}`))
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"id":"x"}` {
		t.Fatalf("unexpected text: %s", text)
	}
}

func TestExtractOutputTextFromOutputContent(t *testing.T) {
	text, err := extractOutputText([]byte(`{"output":[{"content":[{"type":"output_text","text":"{\"id\":\"x\"}"}]}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"id":"x"}` {
		t.Fatalf("unexpected text: %s", text)
	}
}

func TestParseUsage(t *testing.T) {
	usage := parseUsage([]byte(`{
		"usage": {
			"input_tokens": 120,
			"output_tokens": 80,
			"total_tokens": 200,
			"input_tokens_details": { "cached_tokens": 24 },
			"output_tokens_details": { "reasoning_tokens": 18 }
		}
	}`))

	if usage.InputTokens != 120 || usage.OutputTokens != 80 || usage.TotalTokens != 200 {
		t.Fatalf("unexpected usage: %+v", usage)
	}
	if usage.CachedTokens != 24 || usage.ReasoningTokens != 18 {
		t.Fatalf("unexpected token details: %+v", usage)
	}
}

func TestOpenAIMetricsOutput(t *testing.T) {
	recordOpenAIRequest("generate_week", "gpt-test", "success", 150*time.Millisecond)
	recordOpenAIUsage("generate_week", "gpt-test", openAIUsage{InputTokens: 10, OutputTokens: 20, TotalTokens: 30})

	var out strings.Builder
	WriteOpenAIMetrics(&out)
	text := out.String()

	for _, expected := range []string{
		`mealplanner_openai_requests_total{operation="generate_week",model="gpt-test",status="success"}`,
		`mealplanner_openai_tokens_total{operation="generate_week",model="gpt-test",type="input"} 10`,
		`mealplanner_openai_tokens_total{operation="generate_week",model="gpt-test",type="output"} 20`,
		`mealplanner_openai_tokens_total{operation="generate_week",model="gpt-test",type="total"} 30`,
	} {
		if !strings.Contains(text, expected) {
			t.Fatalf("metrics output missing %q in:\n%s", expected, text)
		}
	}
}
