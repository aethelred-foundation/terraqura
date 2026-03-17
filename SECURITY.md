# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in TerraQura, please report it responsibly. **Do not open a public GitHub issue.**

### Contact

- **Email:** security@aethelred.io
- **PGP:** Available on request

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### Response Timeline

| Stage | SLA |
|-------|-----|
| Acknowledgment | 48 hours |
| Initial assessment | 5 business days |
| Fix timeline communicated | 10 business days |
| Patch released | Depends on severity |

## Scope

### In Scope

- Smart contracts (Solidity EVM)
- Backend API endpoints
- Authentication and authorization logic
- Cryptographic implementations
- Oracle data verification
- Frontend security (XSS, CSRF, injection)

### Out of Scope

- Denial of service via rate-limited endpoints
- Social engineering attacks
- Third-party dependencies (report upstream)
- Issues in test or development environments

## Security Features

**Smart contracts:** Reentrancy guards, UUPS upgradeable proxy pattern, circuit breaker emergency pause, multisig admin (2-of-3), timelock on upgrades, role-based access control (MINTER_ROLE, OPERATOR_ROLE, ADMIN_ROLE), checked arithmetic.

**Application layer:** JWT + SIWE auth, RBAC, Zod input validation, per-endpoint rate limiting, CORS, Helmet headers, parameterised queries.

**Infrastructure:** TLS 1.3, ADGM data residency (UAE), DDoS protection, container security contexts, secrets management.

## Bug Bounty

A bug bounty program will be announced prior to mainnet launch. Details will be published at [aethelred.io/security](https://aethelred.io/security).

## Supported Versions

| Version | Supported |
|---------|-----------|
| main (pre-mainnet) | Yes |
| Older branches | No |
