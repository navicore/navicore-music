# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to the maintainer via GitHub issues with the "security" label.

## Known Issues

### Allowed Advisories

The following security advisories are acknowledged but do not affect our application:

1. **RUSTSEC-2024-0370** - proc-macro-error is unmaintained
   - Status: Warning (not a vulnerability)
   - Impact: None - this is a transitive dependency of Yew
   - Mitigation: Waiting for Yew to update dependencies

2. **RUSTSEC-2023-0071** - RSA Marvin Attack in sqlx-mysql
   - Status: Medium severity vulnerability
   - Impact: None - we only use SQLite, not MySQL
   - Mitigation: The sqlx crate v0.8 incorrectly includes all database drivers even when not needed. This will be fixed when sqlx releases a version that properly respects feature flags.

## Security Measures

- All dependencies are regularly audited using `cargo audit`
- Strict clippy lints are enforced in CI/CD
- No secrets or credentials are stored in the repository
- Cloudflare R2 access uses time-limited presigned URLs
- Authentication uses industry-standard JWT tokens with argon2 password hashing