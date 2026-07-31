# TerraQura public-testnet deployment candidate

## Status and scope

This is the operator runbook for validating and, only after a separate release
approval, deploying the TerraQura public-testnet candidate. Preflight commands
are read-only. Bootstrap and finalize broadcast transactions and require
explicit interlocks; do not run them merely because this document exists.

The candidate contains exactly five UUPS proxies:

1. `TerraQuraAccessControl`
2. `CircuitBreaker`
3. `VerificationEngine`
4. `CarbonCredit`
5. `CarbonMarketplace`

Older deployments included a multisig, timelock, forwarder, gasless
marketplace, native oracle, retirement contracts, auctions, vaults, and other
modules. Those contracts and removed `deploy.ts`, `redeploy-*`,
`deploy-enterprise*`, `deploy-mainnet`, and `remove-vercel` workflows are not
part of this candidate. Do not run an old script against these proxies, add an
old address to the candidate environment, or reuse an old manifest.

## Release inputs and responsibilities

The release owner supplies the approved 40-character Git SHA, expected chain
ID and HTTPS RPC, and these custody-controlled addresses:

- a temporary deployment signer with testnet AETH;
- `PROTOCOL_OWNER_ADDRESS`, independent of the deployer;
- `OPERATOR_SIGNER_ADDRESS`, independent of the deployer;
- `FEE_RECIPIENT_ADDRESS`;
- an HTTPS metadata base URI and reviewed marketplace fee;
- a durable checkpoint directory writable only by the operator.

The protocol owner receives default-admin, admin, upgrader, and pauser roles.
The operator receives operator, minter, and compliance roles. Finalize removes
the deployment signer's privileged roles, ownership, and pauser status.

Use separate people for transaction execution and on-chain review. Never share
private keys in chat, Git, an env example, shell history, checkpoint, or
manifest.

## 1. Immutable checkout

Use a fresh directory, not a long-lived working copy:

```bash
export TERRAQURA_SOURCE_SHA='<approved-40-character-sha>'
git clone https://github.com/aethelred-foundation/terraqura.git terraqura-candidate
cd terraqura-candidate
git fetch --force origin "$TERRAQURA_SOURCE_SHA"
git checkout --detach "$TERRAQURA_SOURCE_SHA"
test "$(git rev-parse HEAD)" = "$TERRAQURA_SOURCE_SHA"
test -z "$(git status --porcelain)"
```

A branch name is not a release identifier. Record the remote and exact SHA.

The supported runtime line is Node `20.18.x`; the deployment ceremony requires
the reviewed `20.18.3` patch pinned in both `.nvmrc` and `.node-version` and
rejects Node 25 or any other drift. Preflight also proves that both version
files, the engine range, the root `packageManager` field, and the running pnpm
`9.0.0` agree.

```bash
nvm install
nvm use
test "$(node --version)" = "v$(cat .nvmrc)"
test "$(cat .node-version)" = "$(cat .nvmrc)"
corepack enable
corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate
test "$(pnpm --version)" = "9.0.0"
```

## 2. Source validation

The lockfile is authoritative. Do not update dependencies during the ceremony.

```bash
HUSKY=0 pnpm install --frozen-lockfile
pnpm contracts:compile
pnpm contracts:test
pnpm --filter @terraqura/contracts typecheck
pnpm --filter @terraqura/api test
pnpm typecheck
pnpm build:api
pnpm build:web
test -z "$(git status --porcelain)"
```

Stop if any command fails or modifies a tracked file. Archive output with the
release evidence.

## 3. Contract ceremony configuration

Copy the sanitized template outside the repository:

```bash
install -m 0600 \
  deploy/terraqura.contracts.public-testnet.env.example \
  /secure/operator/terraqura-contracts.env
```

Fill every required field. The private key is a mode-`0400` file referenced by
`DEPLOYER_SIGNER_KEY_FILE`, never a value in this env file.

```bash
set -a
. /secure/operator/terraqura-contracts.env
set +a
test "$TERRAQURA_SOURCE_COMMIT" = "$(git rev-parse HEAD)"
```

Keep both confirmation flags `false`. The checkpoint must be on durable,
encrypted storage outside the checkout.

## 4. Read-only preflight

```bash
pnpm contracts:preflight
```

Preflight performs no transaction. It verifies immutable SHA and a clean source
checkout;
Node, network, HTTPS RPC, and chain ID; signer balance and role separation;
addresses, metadata URL, and fee bounds; UUPS safety for all five
implementations; and checkpoint compatibility.

The mode-`0600` checkpoint digest binds source SHA, chain, deployer, owner,
operator, fee recipient, metadata URI, and fee. Changing an input requires a
new review.

```bash
sha256sum "$TERRAQURA_DEPLOYMENT_CHECKPOINT"
```

An independent reviewer must approve the output and checksum before bootstrap.

## 5. Phase A: resumable bootstrap

This phase is transaction-bearing. It deploys only five implementations and
five ERC-1967 proxies. It does not perform final wiring or governance transfer.

```bash
export CONFIRM_TESTNET_DEPLOY=true
export CONFIRM_TESTNET_FINALIZE=false
pnpm contracts:bootstrap
export CONFIRM_TESTNET_DEPLOY=false
```

Before each transaction, the tool records the deployer nonce and deterministic
expected address. It records the transaction hash before waiting. On retry it
reuses verified code, reconciles a receipt, clears a confirmed failed
transaction, or stops if the signer nonce moved unexpectedly. It never silently
starts a second deployment while an action is unresolved.

Do not delete the checkpoint or lock to bypass an error. If the host or RPC
fails, rerun the same command with the same commit, env, signer, and checkpoint.
Do not use a removed redeploy script.

After bootstrap, back up the checkpoint and independently verify five proxy and
five implementation addresses, bytecode at each address, matching ERC-1967
implementation slots, and unchanged SHA/digest. Do not update API or web env
from an unfinalized checkpoint.

## 6. Phase B: idempotent finalize

Finalize wires contracts, registers circuit-breaker monitoring, enables KYC,
assigns roles, transfers ownership, and removes deployer privilege. Every
action reads current state first, so the same phase safely skips completed
actions.

```bash
export CONFIRM_TESTNET_DEPLOY=false
export CONFIRM_TESTNET_FINALIZE=true
pnpm contracts:finalize
export CONFIRM_TESTNET_FINALIZE=false
```

Finalize writes a sibling
`aethelred-testnet-7332.manifest.json`. Preserve checkpoint and manifest.

```bash
pnpm contracts:verify
sha256sum "$TERRAQURA_DEPLOYMENT_CHECKPOINT"
sha256sum \
  "$(dirname "$TERRAQURA_DEPLOYMENT_CHECKPOINT")/aethelred-testnet-7332.manifest.json"
```

Verification fails unless all five proxy slots match; contract wiring, fee, and
KYC match; the operator is a minter with operational roles; the breaker
monitors verification, credit, and marketplace; the protocol owner owns all
ownable contracts and holds privileged roles; and the deployer retains no
privileged role or pauser status.

Explorer source publication may follow using implementation addresses and the
exact SHA. It does not replace direct RPC verification.

## 7. Manifest propagation

Use only the finalized five-proxy manifest:

| Manifest key               | API variable                  | Web variable                              |
| -------------------------- | ----------------------------- | ----------------------------------------- |
| `accessControl.proxy`      | `ACCESS_CONTROL_ADDRESS`      | `NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS`      |
| `verificationEngine.proxy` | `VERIFICATION_ENGINE_ADDRESS` | `NEXT_PUBLIC_VERIFICATION_ENGINE_ADDRESS` |
| `carbonCredit.proxy`       | `CARBON_CREDIT_ADDRESS`       | `NEXT_PUBLIC_CARBON_CREDIT_ADDRESS`       |
| `carbonMarketplace.proxy`  | `CARBON_MARKETPLACE_ADDRESS`  | `NEXT_PUBLIC_CARBON_MARKETPLACE_ADDRESS`  |
| `circuitBreaker.proxy`     | `CIRCUIT_BREAKER_ADDRESS`     | `NEXT_PUBLIC_CIRCUIT_BREAKER_ADDRESS`     |

Use:

- `deploy/terraqura.api.production.env.example`
- `deploy/terraqura.web.production.env.example`
- `deploy/terraqura.production.env.example` for Compose

All public origins, RPC, explorer, and API URLs require HTTPS.
`AETHEL_USD_PRICE` is optional; absent pricing produces `null` USD fields.
Never substitute another asset price. Forwarder, gasless marketplace, multisig,
timelock, and oracle variables remain unset for this candidate.

## 8. Database and migration

Do not point the candidate at an old TerraQura database by default. Before reuse:

1. stop old writes;
2. checksum a logical dump and provider snapshot;
3. record old SHA, schema, chain ID, and contract addresses;
4. review stored identifiers/state against the five-proxy candidate;
5. restore into isolation and run migration plus smoke tests;
6. obtain explicit data-owner approval.

Without that review, create a fresh PostgreSQL 16 database. Never expose 5432.

```bash
cp deploy/terraqura.production.env.example .env
chmod 600 .env
# Fill required values and use a mode-0400 OPERATOR_SIGNER_KEY_FILE.
docker compose --env-file .env -f docker-compose.production.yml config --quiet
docker compose --env-file .env -f docker-compose.production.yml build
docker compose --env-file .env -f docker-compose.production.yml up -d postgres
docker compose --env-file .env -f docker-compose.production.yml run --rm \
  api node dist/scripts/migrate.js
```

For a separate API service:

```bash
pnpm build:api
pnpm db:migrate
pnpm start:api
```

Migrate before new code receives traffic. Preserve migration output.

## 9. API and web hosting

Compose runs PostgreSQL only on its private network, API on
`127.0.0.1:4000`, and web on `127.0.0.1:3007`.

```bash
docker compose --env-file .env -f docker-compose.production.yml up -d api web
docker compose --env-file .env -f docker-compose.production.yml ps
```

For a separate web process:

```bash
pnpm build:web
PORT=3007 pnpm start:web
```

Bind services to loopback/private networks. Do not expose 3007, 4000, or 5432.

## 10. TLS reverse proxy

Terminate organization-managed TLS at the proxy:

- `https://terraqura.example` to `http://127.0.0.1:3007`;
- `https://api.terraqura.example` to `http://127.0.0.1:4000`.

Require TLS 1.2+, redirect HTTP, preserve host, set `X-Forwarded-Proto https`,
and configure the exact trusted hop count. Use request limits compatible with
the gateway (2 MiB, 15 seconds). Keep API docs disabled or access-controlled.
Never enable `TERRAQURA_ALLOW_INSECURE_UPSTREAM` in production.

## 11. Health and smoke checks

```bash
curl --fail --silent --show-error http://127.0.0.1:4000/v1/health
curl --fail --silent --show-error http://127.0.0.1:4000/v1/health/ready
curl --fail --silent --show-error http://127.0.0.1:3007/
curl --fail --silent --show-error https://api.terraqura.example/v1/health/ready
curl --fail --silent --show-error https://terraqura.example/
curl --fail --silent --show-error \
  https://terraqura.example/api/terraqura/v1/health/ready
```

Readiness must show database and blockchain true. With a test wallet confirm
chain ID/five addresses, SIWE domain, read-only views, unauthorized operator
denial, KYC fail-closed behavior, wallet confirmation, and explorer references.
Do not seed, mint, list, or buy without an approved test plan.

## 12. Recovery and rollback

Never erase a partial checkpoint. Rerun the same phase and let it reconcile
code, receipt, expected address, and nonce. Unexpected nonce or a successful
receipt without code is an incident; do not deploy around it.

Once ownership transfers, source rollback does not roll back chain state.
Contract changes require reviewed governance and a new release record.

For API/web rollback, remove candidate traffic, restore the last verified image
digests/SHA, and rerun readiness checks. Do not mix a new manifest with an old
build unless tested.

Container rollback is not database rollback. Use a tested backward migration or
restore the pre-deployment snapshot, preserving failed-state evidence first.
Never reconnect an unreviewed old database.

## Release gate

A successful build or preflight is not deploy authorization. Release only after
the SHA, tests, checkpoint, finalized manifest, on-chain verification, database
decision, TLS configuration, smoke checks, and rollback evidence are approved.
