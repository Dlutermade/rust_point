.PHONY: up down logs internal-api storefront-api grant-worker expiry-job build check fmt lint test

# Container engine: inherited from the root Makefile when delegated;
# auto-detected here when invoked directly (podman first, docker fallback).
COMPOSE ?= $(shell command -v podman >/dev/null 2>&1 && echo podman compose || echo docker compose)

# ── point-center owned infrastructure ──

up:            ## start point-center owned infra (PostgreSQL)
	$(COMPOSE) up -d

down:          ## stop point-center owned infra
	$(COMPOSE) down

logs:          ## follow point-center infra logs
	$(COMPOSE) logs -f

# ── run (delivery shells) ──

internal-api:  ## ops-facing API: issuance lifecycle
	cargo run -p point-center-internal-api

storefront-api: ## storefront-facing API: redeem / balance / transactions
	cargo run -p point-center-storefront-api

grant-worker:  ## NATS consumer, grant pipeline (open more terminals = more instances)
	cargo run -p point-center-grant-worker

expiry-job:    ## one run-to-completion expiry sweep (scheduling is external)
	cargo run -p point-center-expiry-job

# ── cargo (this project's own workspace) ──

build:
	cargo build --workspace

check:
	cargo check --workspace

fmt:
	cargo fmt --all

lint:
	cargo clippy --workspace --all-targets -- -D warnings

test:
	cargo test --workspace
