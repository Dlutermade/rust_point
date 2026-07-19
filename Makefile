.PHONY: up down logs build check fmt lint test

# Container engine: podman if present, otherwise docker.
# Override anytime: make up COMPOSE="docker compose"
COMPOSE ?= $(shell command -v podman >/dev/null 2>&1 && echo podman compose || echo docker compose)
export COMPOSE

# ── shared infrastructure (NATS message bus) + project coordination ──
# All project-specific targets (run, infra, cargo) live in projects/<name>/Makefile.
# One Cargo workspace per project; adding a project = add its delegation lines here.

up:            ## start shared infra (NATS), then every project's own infra
	$(COMPOSE) up -d
	$(MAKE) -C projects/point-center up

down:          ## stop every project's infra, then shared infra
	$(MAKE) -C projects/point-center down
	$(COMPOSE) down

logs:          ## follow shared infra logs
	$(COMPOSE) logs -f

# ── cargo (delegated: one workspace per project) ──

build:
	$(MAKE) -C projects/point-center build

check:
	$(MAKE) -C projects/point-center check

fmt:
	$(MAKE) -C projects/point-center fmt

lint:
	$(MAKE) -C projects/point-center lint

test:
	$(MAKE) -C projects/point-center test
