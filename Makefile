.PHONY: all build check test clippy fmt clean run-backend run-frontend ci

# Default target
all: fmt clippy test build

# Build all targets
build:
	@echo "Building all workspace members..."
	cargo build --workspace --all-targets

# Build release
build-release:
	@echo "Building release..."
	cargo build --workspace --release --all-targets

# Run checks (fast CI)
check:
	@echo "Running cargo check..."
	cargo check --workspace --all-targets

# Run tests
test:
	@echo "Running tests..."
	cargo test --workspace --all-targets

# Run clippy with strict lints
clippy:
	@echo "Running clippy..."
	cargo clippy --workspace --all-targets -- \
		-W clippy::all \
		-W clippy::pedantic \
		-W clippy::nursery \
		-W clippy::cargo \
		-W rust-2024-compatibility \
		-A clippy::module_name_repetitions \
		-A clippy::must_use_candidate \
		-A clippy::missing_errors_doc \
		-A clippy::missing_panics_doc \
		-A clippy::multiple_crate_versions

# Format code
fmt:
	@echo "Formatting code..."
	cargo fmt --all
	@echo "Checking format..."
	cargo fmt --all -- --check

# Clean build artifacts
clean:
	@echo "Cleaning..."
	cargo clean

# Run backend
run-backend:
	@echo "Running backend..."
	cargo run -p backend

# Build frontend WASM
build-frontend:
	@echo "Building frontend..."
	cd frontend && wasm-pack build --target web --out-dir ../backend/static/wasm

# Development server with watch
dev:
	@echo "Starting development server..."
	cargo watch -x "run -p backend"

# CI pipeline - this is what GitHub Actions will run
ci: fmt clippy test build
	@echo "CI checks passed!"

# Install development dependencies
install-deps:
	@echo "Installing development dependencies..."
	cargo install cargo-watch
	cargo install wasm-pack
	cargo install sqlx-cli --no-default-features --features sqlite

# Setup database
setup-db:
	@echo "Setting up database..."
	cd backend && sqlx database create
	cd backend && sqlx migrate run

# Lint TOML files
lint-toml:
	@echo "Checking TOML files..."
	@command -v taplo >/dev/null 2>&1 || (echo "Installing taplo..." && cargo install taplo-cli --locked)
	taplo fmt --check

# Security audit
audit:
	@echo "Running security audit..."
	cargo audit

# Full check - everything
full-check: fmt lint-toml clippy test audit build
	@echo "All checks passed!"