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
	openAIMetrics.mu.Lock()
	requests := make(map[openAIRequestKey]openAIRequestMetric, len(openAIMetrics.requests))
	requestKeys := make([]openAIRequestKey, 0, len(openAIMetrics.requests))
	for key, value := range openAIMetrics.requests {
		requests[key] = value
		requestKeys = append(requestKeys, key)
	}
	tokens := make(map[openAITokenKey]uint64, len(openAIMetrics.tokens))
	tokenKeys := make([]openAITokenKey, 0, len(openAIMetrics.tokens))
	for key, value := range openAIMetrics.tokens {
		tokens[key] = value
		tokenKeys = append(tokenKeys, key)
	}
	openAIMetrics.mu.Unlock()

	sort.Slice(requestKeys, func(i, j int) bool {
		return requestKeyLess(requestKeys[i], requestKeys[j])
	})
	sort.Slice(tokenKeys, func(i, j int) bool {
		if tokenKeys[i].Operation != tokenKeys[j].Operation {
			return tokenKeys[i].Operation < tokenKeys[j].Operation
		}
		if tokenKeys[i].Model != tokenKeys[j].Model {
			return tokenKeys[i].Model < tokenKeys[j].Model
		}
		return tokenKeys[i].Type < tokenKeys[j].Type
	})

	fmt.Fprintln(w, "# HELP mealplanner_openai_requests_total Total OpenAI Responses API calls.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_requests_total counter")
	for _, key := range requestKeys {
		fmt.Fprintf(w, "mealplanner_openai_requests_total{operation=%s,model=%s,status=%s} %d\n", label(key.Operation), label(key.Model), label(key.Status), requests[key].Count)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_request_duration_seconds_sum Total OpenAI request duration in seconds.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_request_duration_seconds_sum counter")
	for _, key := range requestKeys {
		fmt.Fprintf(w, "mealplanner_openai_request_duration_seconds_sum{operation=%s,model=%s,status=%s} %.6f\n", label(key.Operation), label(key.Model), label(key.Status), requests[key].DurationSum)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_request_duration_seconds_count Total OpenAI request duration observations.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_request_duration_seconds_count counter")
	for _, key := range requestKeys {
		fmt.Fprintf(w, "mealplanner_openai_request_duration_seconds_count{operation=%s,model=%s,status=%s} %d\n", label(key.Operation), label(key.Model), label(key.Status), requests[key].Count)
	}
	fmt.Fprintln(w, "# HELP mealplanner_openai_tokens_total Total tokens reported by OpenAI usage.")
	fmt.Fprintln(w, "# TYPE mealplanner_openai_tokens_total counter")
	for _, key := range tokenKeys {
		fmt.Fprintf(w, "mealplanner_openai_tokens_total{operation=%s,model=%s,type=%s} %d\n", label(key.Operation), label(key.Model), label(key.Type), tokens[key])
	}
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
