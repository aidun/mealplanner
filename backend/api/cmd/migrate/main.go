package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/aidun/mealplanner/backend/api/internal/config"
	"github.com/aidun/mealplanner/backend/api/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if len(os.Args) > 1 && os.Args[1] != "up" {
		log.Fatal("unsupported migration command")
	}
	if err := store.MigrateUp(ctx, pool); err != nil {
		log.Fatal(err)
	}
}
