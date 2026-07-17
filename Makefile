.PHONY: up down logs api worker build check fmt lint test

up:            ## start NATS + PostgreSQL
	docker compose up -d

down:          ## stop infrastructure
	docker compose down

logs:          ## follow infrastructure logs
	docker compose logs -f

api:           ## run the HTTP API
	cargo run -p points-api

worker:        ## run a worker instance (open more terminals = more instances)
	cargo run -p points-worker

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
