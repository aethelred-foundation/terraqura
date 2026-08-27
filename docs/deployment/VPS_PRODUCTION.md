# TerraQura VPS production deployment

This service reference deploys TerraQura web, API, and PostgreSQL. The web and
API bind only to host loopback on ports `3007` and `4000`; TLS must terminate at
the reverse proxy. The complete immutable-SHA contract and application
procedure is [PUBLIC_TESTNET_DEPLOYMENT.md](PUBLIC_TESTNET_DEPLOYMENT.md).

## Prerequisites

- Docker Engine with the Compose v2 plugin
- HTTPS hostnames for web and API, such as `terraqura.aethelred.network` and
  `api.terraqura.aethelred.network`
- DNS for that hostname pointing to the backend host
- A reverse proxy forwarding web to `127.0.0.1:3007` and API to
  `127.0.0.1:4000`
- Production KYC, signer, database, and JWT secrets

Do not expose port 5432 on the host firewall.

The operator signing key must be generated, rotated, and audited by the
organization's custody or secrets-management service. Materialize it only as a
mode-`0400` file for the deployment service account. Compose mounts it into the
API as a read-only secret at `/run/secrets/terraqura_operator_signer`; it is
never accepted through a production environment variable.

## Configure

```bash
cp deploy/terraqura.production.env.example .env
chmod 600 .env
```

Replace every blank value. `JWT_SECRET` must contain at least 32 random
characters. The on-chain addresses, chain ID, and RPC endpoint must be verified
against the finalized five-proxy manifest before starting the stack. Do not mix
legacy contract addresses or reuse an old database without the snapshot and
compatibility review in the complete runbook.

## Validate and start

```bash
docker compose --env-file .env -f docker-compose.production.yml config --quiet
docker compose --env-file .env -f docker-compose.production.yml build
docker compose --env-file .env -f docker-compose.production.yml run --rm \
  api node dist/scripts/migrate.js
docker compose --env-file .env -f docker-compose.production.yml up -d
docker compose --env-file .env -f docker-compose.production.yml ps
```

The API is ready only when both PostgreSQL and Aethelred RPC checks pass, and
the web is ready only when its local health check passes:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:4000/v1/health/ready
curl --fail --silent --show-error \
  http://127.0.0.1:3007/
```

After the reverse proxy is active, verify the public TLS endpoint:

```bash
curl --fail --silent --show-error \
  https://api.terraqura.aethelred.network/v1/health/ready
```

Set `API_PUBLIC_ORIGIN` to that HTTPS API origin. The browser uses the
same-origin `/api/terraqura` gateway, so backend topology and CORS details are
not exposed to end users.

## Upgrade

Build first, then replace services with health-gated containers:

```bash
git pull --ff-only
docker compose --env-file .env -f docker-compose.production.yml build
docker compose --env-file .env -f docker-compose.production.yml up -d
docker compose --env-file .env -f docker-compose.production.yml ps
```

Run database migrations before directing traffic to code that depends on the
new schema:

```bash
docker compose --env-file .env -f docker-compose.production.yml run --rm \
  api node dist/scripts/migrate.js
```

Use a tested compatibility window when an upgrade changes stored state.

## Rollback

Check out the last verified commit, rebuild, and start the stack again. Database
schema changes require a tested backward migration or a point-in-time restore;
do not treat container rollback as database rollback.
