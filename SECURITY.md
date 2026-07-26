# Security policy

Report suspected vulnerabilities privately to `security@aethelred.io`. Include
affected component and version, reproduction steps, impact, and any suggested
mitigation. Do not publish an exploit or open a public issue before the team has
had a reasonable opportunity to investigate.

The supported scope is the current `main` branch:

- Solidity contracts and deployment scripts;
- API authentication, authorization, KYC/sanctions, custody, and indexing;
- sensor credential issuance and telemetry ingestion;
- web wallet and transaction flows; and
- production container and proxy configuration.

Repository checks are not an independent audit. Production operators remain
responsible for TLS termination, secret storage, database backups, monitoring,
incident response, governance key custody, and contract review before mainnet.
