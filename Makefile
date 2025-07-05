.PHONY: all install dev test lint check clean help build-wasm

# Default target
all: help

# Help message
help:
	@echo "Navicore Music - Development Commands"
	@echo "===================================="
	@echo "make install       - Install dependencies"
	@echo "make build-wasm   - Build WASM frontend module"
	@echo "make check        - Run all checks (lint + test)"
	@echo "make lint         - Check code quality"
	@echo "make test         - Run tests (currently placeholder)"
	@echo "make dev          - Start local development server"
	@echo "make clean        - Clean build artifacts"
	@echo ""
	@echo "NOTE: Deployment is handled by GitHub Actions only!"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Build WASM frontend
build-wasm:
	@echo "=== Building WASM frontend ==="
	@command -v wasm-pack >/dev/null 2>&1 || { echo "wasm-pack not found. Install with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"; exit 1; }
	@command -v rustc >/dev/null 2>&1 || { echo "Rust not found. Please install Rust from https://rustup.rs/"; exit 1; }
	@echo "Building WASM module..."
	@cd frontend && wasm-pack build --target web --out-dir ../dist/wasm
	@echo "WASM build complete!"
	@echo "Generated files:"
	@ls -la dist/wasm/ | grep -E '\.(js|wasm|d\.ts)$$'

# Run all checks (what CI runs)
check: lint test
	@echo "All checks passed!"

# Lint and validate code
lint:
	@echo "=== Validating package.json ==="
	@test -f package.json && echo "package.json exists" || (echo "Missing package.json" && exit 1)
	
	@echo "\n=== Checking HTML files ==="
	@find dist -name "*.html" -exec echo "Checking {}" \; -exec node -e "\
		const fs = require('fs'); \
		const content = fs.readFileSync('{}', 'utf8'); \
		if (!content.includes('<!DOCTYPE html>')) console.error('{}: Missing DOCTYPE'); \
		if (!content.includes('<html')) console.error('{}: Missing html tag'); \
		if (!content.includes('</html>')) console.error('{}: Missing closing html tag'); \
	" \;
	
	@echo "\n=== Checking JavaScript in HTML ==="
	@find dist -name "*.html" -exec grep -l "<script" {} \; 2>/dev/null | while read file; do \
		echo "Checking $$file"; \
		node -e "\
			const fs = require('fs'); \
			const content = fs.readFileSync('$$file', 'utf8'); \
			const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || []; \
			let hasError = false; \
			scripts.forEach((script, i) => { \
				const code = script.replace(/<script[^>]*>|<\/script>/g, ''); \
				if (code.trim() && !code.includes('import ')) { \
					try { \
						new Function(code); \
					} catch (e) { \
						console.error('$$file: Script ' + i + ' has syntax error: ' + e.message); \
						hasError = true; \
					} \
				} \
			}); \
			if (hasError) process.exit(1); \
		" || exit 1; \
	done
	
	@echo "\n=== Checking Worker JavaScript ==="
	@node -c build/worker/shim.mjs || (echo "Worker shim.mjs has syntax errors" && exit 1)
	@node -c build/worker/zip-utils.mjs || (echo "Worker zip-utils.mjs has syntax errors" && exit 1)
	
	@echo "\n=== Verifying required files ==="
	@test -f wrangler.toml || (echo "Missing wrangler.toml" && exit 1)
	@test -f package.json || (echo "Missing package.json" && exit 1)
	@test -d dist || (echo "Missing dist directory" && exit 1)
	@test -f dist/index.html || (echo "Missing dist/index.html" && exit 1)
	@test -f build/worker/shim.mjs || (echo "Missing worker file" && exit 1)
	
	@echo "\nAll lint checks passed!"

# Run tests
test:
	@echo "=== Running tests ==="
	@echo "TODO: Add actual unit tests"
	@echo "Tests placeholder - no tests defined yet"

# Development server
dev:
	@echo "Starting Wrangler dev server..."
	npm run dev:api

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf node_modules
	rm -rf test-build
	rm -f package-lock.json
	rm -rf dist/wasm/*.js dist/wasm/*.wasm dist/wasm/*.d.ts dist/wasm/package.json
	rm -rf frontend/target
	rm -rf frontend/pkg
	@echo "Clean complete"

# Run checks before committing
pre-commit: check
	@echo "Ready to commit!"