package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/auth"
	"github.com/aidun/mealplanner/backend/api/internal/config"
	"github.com/aidun/mealplanner/backend/api/internal/httpapi"
	"github.com/aidun/mealplanner/backend/api/internal/mailer"
	"github.com/aidun/mealplanner/backend/api/internal/planner"
	"github.com/aidun/mealplanner/backend/api/internal/provider"
	"github.com/aidun/mealplanner/backend/api/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	generator, err := buildGenerator(cfg)
	if err != nil {
		log.Fatal(err)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	appMailer, err := mailer.New(mailer.Config{
		Enabled:      cfg.EmailEnabled,
		Provider:     cfg.EmailProvider,
		From:         cfg.EmailFrom,
		ReplyTo:      cfg.EmailReplyTo,
		ResendAPIKey: cfg.ResendAPIKey,
	})
	if err != nil {
		log.Fatal(err)
	}
	authService := auth.NewService(auth.Config{
		BaseURL:              cfg.AuthBaseURL,
		SessionSecret:        cfg.SessionSecret,
		AllowedSubjectHashes: cfg.AuthAllowedSubjectHashes,
		AllowedEmailHashes:   cfg.AuthAllowedEmailHashes,
		GoogleClientID:       cfg.GoogleClientID,
		GoogleClientSecret:   cfg.GoogleClientSecret,
		AppleClientID:        cfg.AppleClientID,
		AppleTeamID:          cfg.AppleTeamID,
		AppleKeyID:           cfg.AppleKeyID,
		ApplePrivateKey:      cfg.ApplePrivateKey,
	})
	handler := httpapi.New(httpapi.StoreRepository{Store: store.New(pool)}, planner.New(generator), authService, cfg.APISecret, cfg.CORSOrigins, logger, appMailer)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	logger.Info("mealplanner api listening", "port", cfg.Port, "providerMode", cfg.ProviderMode)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

// buildGenerator keeps the provider switch at startup so request handling stays mode-agnostic.
func buildGenerator(cfg config.Config) (planner.Generator, error) {
	if strings.EqualFold(cfg.ProviderMode, "live") {
		return provider.NewOpenAIGenerator(provider.OpenAIConfig{APIKey: cfg.OpenAIAPIKey, Model: cfg.OpenAIModel})
	}
	return provider.NewMockGenerator(), nil
}
