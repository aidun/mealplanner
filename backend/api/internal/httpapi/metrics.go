package httpapi

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Metrics struct {
	mu       sync.Mutex
	requests map[metricKey]requestMetric
	started  time.Time
}

type metricKey struct {
	Method string
	Path   string
	Status string
}

type requestMetric struct {
	Count       uint64
	DurationSum float64
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func NewMetrics() *Metrics {
	return &Metrics{
		requests: map[metricKey]requestMetric{},
		started:  time.Now(),
	}
}

func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		m.Observe(r.Method, routePattern(r), recorder.status, time.Since(start))
	})
}

func (m *Metrics) Observe(method string, path string, status int, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := metricKey{Method: method, Path: path, Status: strconv.Itoa(status)}
	current := m.requests[key]
	current.Count++
	current.DurationSum += duration.Seconds()
	m.requests[key] = current
}

func (m *Metrics) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	m.mu.Lock()
	keys := make([]metricKey, 0, len(m.requests))
	for key := range m.requests {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].Path == keys[j].Path {
			if keys[i].Method == keys[j].Method {
				return keys[i].Status < keys[j].Status
			}
			return keys[i].Method < keys[j].Method
		}
		return keys[i].Path < keys[j].Path
	})
	snapshot := make(map[metricKey]requestMetric, len(m.requests))
	for _, key := range keys {
		snapshot[key] = m.requests[key]
	}
	uptime := time.Since(m.started).Seconds()
	m.mu.Unlock()

	fmt.Fprintln(w, "# HELP mealplanner_up Whether the Mealplanner API process is running.")
	fmt.Fprintln(w, "# TYPE mealplanner_up gauge")
	fmt.Fprintln(w, "mealplanner_up 1")
	fmt.Fprintln(w, "# HELP mealplanner_uptime_seconds API process uptime in seconds.")
	fmt.Fprintln(w, "# TYPE mealplanner_uptime_seconds gauge")
	fmt.Fprintf(w, "mealplanner_uptime_seconds %.3f\n", uptime)
	fmt.Fprintln(w, "# HELP mealplanner_http_requests_total Total HTTP requests handled by the API.")
	fmt.Fprintln(w, "# TYPE mealplanner_http_requests_total counter")
	for _, key := range keys {
		metric := snapshot[key]
		fmt.Fprintf(w, "mealplanner_http_requests_total{method=%q,path=%q,status=%q} %d\n", key.Method, key.Path, key.Status, metric.Count)
	}
	fmt.Fprintln(w, "# HELP mealplanner_http_request_duration_seconds_sum Total HTTP request duration in seconds.")
	fmt.Fprintln(w, "# TYPE mealplanner_http_request_duration_seconds_sum counter")
	for _, key := range keys {
		metric := snapshot[key]
		fmt.Fprintf(w, "mealplanner_http_request_duration_seconds_sum{method=%q,path=%q,status=%q} %.6f\n", key.Method, key.Path, key.Status, metric.DurationSum)
	}
	fmt.Fprintln(w, "# HELP mealplanner_http_request_duration_seconds_count Total HTTP request duration observations.")
	fmt.Fprintln(w, "# TYPE mealplanner_http_request_duration_seconds_count counter")
	for _, key := range keys {
		metric := snapshot[key]
		fmt.Fprintf(w, "mealplanner_http_request_duration_seconds_count{method=%q,path=%q,status=%q} %d\n", key.Method, key.Path, key.Status, metric.Count)
	}
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func routePattern(r *http.Request) string {
	if r.Pattern != "" {
		return r.Pattern
	}
	path := r.URL.Path
	if strings.TrimSpace(path) == "" {
		return "unknown"
	}
	return path
}
