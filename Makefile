.PHONY: run build check fmt lint test web-install web-build web-dev web-lint web-fmt web-fmt-check up down logs psql

# Container engine: podman if present, otherwise docker.
# Override anytime: make up COMPOSE="docker compose"
COMPOSE ?= $(shell command -v podman >/dev/null 2>&1 && echo podman compose || echo docker compose)
export COMPOSE

# One Rust project (storefront-center) plus a pnpm workspace for the front end
# (projects/admin editor, projects/blocks web components). Root has no Cargo.toml:
# each project owns its Cargo workspace, so cargo runs via --manifest-path.
CARGO ?= cargo
SC := projects/storefront-center
MANIFEST := --manifest-path $(SC)/Cargo.toml

# ── Rust: storefront-center ──

run:           ## serve on BIND_ADDR (default 0.0.0.0:3000)
	$(CARGO) run $(MANIFEST)

build:
	$(CARGO) build $(MANIFEST)

check:
	$(CARGO) check $(MANIFEST)

fmt:
	$(CARGO) fmt $(MANIFEST)

lint:
	$(CARGO) clippy $(MANIFEST) --all-targets

test:
	$(CARGO) test $(MANIFEST)

# ── Front end: pnpm workspace ──
# admin resolves @sc/blocks through its dist/, so blocks builds first.
# oxlint/oxfmt are shared from the workspace root (.oxlintrc.json / .oxfmtrc.json)
# and are pointed at the two JS packages explicitly — they never walk into
# projects/storefront-center. Rust keeps its own lint/fmt above (clippy/rustfmt).

web-install:
	pnpm install

web-lint:
	pnpm lint

web-fmt:
	pnpm format

web-fmt-check:
	pnpm format:check

web-build:
	pnpm --filter @sc/blocks build
	pnpm --filter admin build

web-dev:       ## admin editor on the vite dev server
	pnpm --filter @sc/blocks build
	pnpm --filter admin dev

# ── Infrastructure (one compose project per context) ──
# Each context owns its stack in projects/<name>/docker-compose.yml. Root holds
# no compose file: there is nothing shared to run yet. A cross-context event bus
# comes back as a shared compose when a second subscribing context lands
# (see docs/plan/backlog.md).

up:            ## start storefront-center's Postgres + Valkey
	$(COMPOSE) -f $(SC)/docker-compose.yml up -d

down:
	$(COMPOSE) -f $(SC)/docker-compose.yml down

logs:
	$(COMPOSE) -f $(SC)/docker-compose.yml logs -f

psql:          ## interactive shell on the storefront database
	$(COMPOSE) -f $(SC)/docker-compose.yml exec postgres psql -U storefront -d storefront
