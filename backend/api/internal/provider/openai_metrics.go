package provider

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type openAIRequestKey struct {
	Operation string
	Model     string
	Status    string
}

type openAITokenKey struct {
	Operation string
	Model     string
	Type      string
}

type openAIRequestMetric struct {
	Count       uint64
	DurationSum float64
}

type OpenAIRequestMetricSnapshot struct {
	Operation   string
	Model       string
	Status      string
	Count       uint64
	DurationSum float64
}

type OpenAITokenMetricSnapshot struct {
	Operation string
	Model     string
	Type      string
	Count     uint64
}

var openAIMetrics = struct {
	mu       sync.Mutex
	requests map[openAIRequestKey]openAIRequestMetric
	tokens   map[openAITokenKey]uint64
}{
	requests: map[openAIRequestKey]openAIRequestMetric{},
	tokens:   map[openAITokenKey]uint64{},
}

func recordOpenAIRequest(operation, model, status string, duration time.Duration) {
	openAIMetrics.mu.Lock()
	defer openAIMetrics.mu.Unlock()

	key := openAIRequestKey{Operation: operation, Model: model, Status: status}
	current := openAIMetrics.requests[key]
	current.Count++
	current.DurationSum += duration.Seconds()
	openAIMetrics.requests[key] = current
}

func recordOpenAIUsage(operation, model string, usage openAIUsage) {
	values := map[string]int{
		"input":     usage.InputTokens,
		"output":    usage.OutputTokens,
		"reasoning": usage.ReasoningTokens,
		"cached":    usage.CachedTokens,
		"total":     usage.TotalTokens,
	}

	openAIMetrics.mu.Lock()
	defer openAIMetrics.mu.Unlock()
	for tokenType, count := range values {
		if count <= 0 {
			continue
		}
		key := openAITokenKey{Operation: operation, Model: model, Type: tokenType}
		openAIMetrics.tokens[key] += uint64(count)
	}
}

func WriteOpenAIMetrics(w io.Writer) {
	requestMetrics, tokenMetrics := OpenAIMetricsSnapshot()

	fmt.Fprintln(w, "# HELP mealplanner_openai_requests_total Total OpenAI Responses API calls.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_requests_total counter")
	for _, metric := range requestMetrics {
		fmt.Fprintf(w, "mealplanner_openai_requests_total{operation=%s,model=%s,status=%s} %d\n", label(metric.Operation), label(metric.Model), label(metric.Status), metric.Count)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_request_duration_seconds_sum Total OpenAI request duration in seconds.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_request_duration_seconds_sum counter")
	for _, metric := range requestMetrics {
		fmt.Fprintf(w, "mealplanner_openai_request_duration_seconds_sum{operation=%s,model=%s,status=%s} %.6f\n", label(metric.Operation), label(metric.Model), label(metric.Status), metric.DurationSum)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_request_duration_seconds_count Total OpenAI request duration observations.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_request_duration_seconds_count counter")
	for _, metric := range requestMetrics {
		fmt.Fprintf(w, "mealplanner_openai_request_duration_seconds_count{operation=%s,model=%s,status=%s} %d\n", label(metric.Operation), label(metric.Model), label(metric.Status), metric.Count)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_tokens_total Total tokens reported by OpenAI usage.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_tokens_total counter")
	for _, metric := range tokenMetrics {
		fmt.Fprintf(w, "mealplanner_openai_tokens_total{operation=%s,model=%s,type=%s} %d\n", label(metric.Operation), label(metric.Model), label(metric.Type), metric.Count)
	}
}

func OpenAIMetricsSnapshot() ([]OpenAIRequestMetricSnapshot, []OpenAITokenMetricSnapshot) {
	openAIMetrics.mu.Lock()
	requests := make([]OpenAIRequestMetricSnapshot, 0, len(openAIMetrics.requests))
	for key, value := range openAIMetrics.requests {
		requests = append(requests, OpenAIRequestMetricSnapshot{
			Operation:   key.Operation,
			Model:       key.Model,
			Status:      key.Status,
			Count:       value.Count,
			DurationSum: value.DurationSum,
		})
	}
	tokens := make([]OpenAITokenMetricSnapshot, 0, len(openAIMetrics.tokens))
	for key, value := range openAIMetrics.tokens {
		tokens = append(tokens, OpenAITokenMetricSnapshot{
			Operation: key.Operation,
			Model:     key.Model,
			Type:      key.Type,
			Count:     value,
		})
	}
	openAIMetrics.mu.Unlock()

	sort.Slice(requests, func(i, j int) bool {
		return requestKeyLess(
			openAIRequestKey{Operation: requests[i].Operation, Model: requests[i].Model, Status: requests[i].Status},
			openAIRequestKey{Operation: requests[j].Operation, Model: requests[j].Model, Status: requests[j].Status},
		)
	})
	sort.Slice(tokens, func(i, j int) bool {
		if tokens[i].Operation != tokens[j].Operation {
			return tokens[i].Operation < tokens[j].Operation
		}
		if tokens[i].Model != tokens[j].Model {
			return tokens[i].Model < tokens[j].Model
		}
		return tokens[i].Type < tokens[j].Type
	})
	return requests, tokens
}

func requestKeyLess(left, right openAIRequestKey) bool {
	if left.Operation != right.Operation {
		return left.Operation < right.Operation
	}
	if left.Model != right.Model {
		return left.Model < right.Model
	}
	return left.Status < right.Status
}

func label(value string) string {
	return strconv.Quote(strings.TrimSpace(value))
}
