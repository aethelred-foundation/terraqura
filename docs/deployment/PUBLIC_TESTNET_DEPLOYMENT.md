# TerraQura public-testnet deployment candidate

## Status and scope

This is the operator runbook for validating and, only after a separate release
approval, deploying the TerraQura public-testnet candidate. Preflight is
non-broadcasting but creates or reconciles a local checkpoint. Bootstrap and
finalize broadcast transactions and require explicit interlocks; do not run
them merely because this document exists.

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
ID and RPC identity evidence, and these custody-controlled addresses:

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
install -d -m 0700 /secure/operator
install -m 0600 \
  deploy/terraqura.contracts.public-testnet.env.example \
  /secure/operator/terraqura-contracts.env
```

Fill every required field. The private key is a mode-`0400` file referenced by
`DEPLOYER_SIGNER_KEY_FILE`, never a value in this env file.

`DEPLOYER_SIGNER_KEY_FILE` is a path, not the key itself. The referenced file
contains one line in this shape:

```text
0x<64 hexadecimal characters supplied by custody>
```

For a custody-supplied public-testnet key, install it outside the checkout and
restrict it before use:

```bash
install -d -m 0700 /secure/operator
install -m 0600 /path/from/custody/terraqura-deployer.key \
  /secure/operator/terraqura-deployer.key
chmod 0400 /secure/operator/terraqura-deployer.key
```

For evaluation only, a new testnet-only key can be generated directly into the
restricted file. Do not use this command for a production or custody key:

```bash
install -d -m 0700 /secure/operator
umask 077
openssl rand -hex 32 | sed 's/^/0x/' > \
  /secure/operator/terraqura-deployer.key
chmod 0400 /secure/operator/terraqura-deployer.key
```

The deployment package deliberately does not read the repository-root
`.env.local` when `contracts:preflight`, `contracts:bootstrap`,
`contracts:finalize`, or `contracts:verify` runs. Those commands use only the
environment exported by the operator plus ordinary process variables. A
legacy `PRIVATE_KEY` inherited from the login shell is rejected even when
`DEPLOYER_SIGNER_KEY_FILE` is correct; the key-file variable never overrides
it. Clear that legacy variable without displaying its value:

```bash
unset PRIVATE_KEY
set -a
. /secure/operator/terraqura-contracts.env
set +a
test -z "${PRIVATE_KEY:-}"
test "$TERRAQURA_SOURCE_COMMIT" = "$(git rev-parse HEAD)"
env -u PRIVATE_KEY pnpm contracts:signer-key:check
env -u PRIVATE_KEY pnpm contracts:rpc:check
```

The signer-key check validates the absolute path, regular-file type, no
symlink, mode `0400`/`0600`, and exact key format. It never prints the secret.
The RPC check performs only `eth_chainId` and block reads; it verifies the
configured transport policy and anchor without loading the signer or sending a
transaction.
If the legacy-variable error persists, remove or comment `PRIVATE_KEY` from
the invoking service manager or shell profile. Do not inspect it with `env`,
`printenv`, `set`, or shell tracing because those can disclose its value.

HTTPS remains the default RPC policy. The provided evaluation template uses
the current plaintext public-testnet endpoint and therefore includes the exact
`ALLOW_INSECURE_TESTNET_RPC=acknowledge-evaluation-only-plaintext-rpc`
acknowledgement plus `AETHELRED_NETWORK_ANCHOR_BLOCK` and
`AETHELRED_NETWORK_ANCHOR_HASH`. Plaintext is accepted only for chain ID `7332`.
Every ceremony phase checks the chain ID and pinned block hash before any
transaction-bearing operation. Reconfirm that public anchor independently
before use; never copy this exception to mainnet or production.

Keep both confirmation flags `false`. The checkpoint must be on durable,
encrypted storage outside the checkout.

## 4. Non-broadcast preflight

```bash
env -u PRIVATE_KEY pnpm contracts:preflight
```

Preflight broadcasts no transaction. It verifies immutable SHA and a clean
source checkout; Node, network, RPC transport policy, chain ID and optional
anchor; signer balance and role separation; addresses, metadata URL, fee
bounds, UUPS safety for all five implementations, and checkpoint
compatibility. It creates or reconciles the local checkpoint file, so the
checkpoint directory must already be writable and should be backed up.

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
env -u PRIVATE_KEY pnpm contracts:bootstrap
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
env -u PRIVATE_KEY pnpm contracts:finalize
export CONFIRM_TESTNET_FINALIZE=false
```

Finalize writes a sibling
`aethelred-testnet-7332.manifest.json`. Preserve checkpoint and manifest.

```bash
env -u PRIVATE_KEY pnpm contracts:verify
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
- `deploy/terraqura.public-testnet-evaluation.env.example` with
  `docker-compose.public-testnet-evaluation.yml` only for the current direct-IP
  test host

Public application, API, metadata, and explorer origins require HTTPS. HTTPS is
also the default RPC policy. The current public-testnet RPC is the sole
evaluation exception: the API and browser accept its plaintext URL only with
chain ID `7332`, the exact acknowledgement, and both anchor fields from the
reviewed template. The API verifies chain and anchor before listening. The web
disables wallet actions until the same checks pass and displays an
evaluation-only plaintext-transport banner afterward.

Browsers block HTTP RPC calls from an HTTPS page as mixed content. Prefer an
organization-managed HTTPS reverse proxy for the RPC and remove all insecure
RPC acknowledgement variables. If the team temporarily serves the entire
evaluation UI over HTTP, use only test assets and test-only credentials; this
is not a production hosting profile.

`AETHEL_USD_PRICE` is optional; absent pricing produces `null` USD fields.
Never substitute another asset price. Forwarder, gasless marketplace, multisig,
timelock, and oracle variables remain unset for this candidate.

## 8. Current US-host direct-IP evaluation

This is the supported path for `http://93.127.132.52:3007` with API port
`4000`. It is intentionally separate from `docker-compose.production.yml` and
does not weaken that production profile. PostgreSQL remains private; only the
web and API ports are published.

Copy and complete the evaluation environment:

```bash
install -d -m 0700 /secure/operator
install -m 0600 \
  deploy/terraqura.public-testnet-evaluation.env.example \
  /secure/operator/terraqura-public-testnet-evaluation.env
```

Do not invent or reuse old contract addresses. Copy the five proxy addresses
from the finalized manifest. `ADMIN_WALLETS` is an approved governance wallet;
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `DB_PASSWORD`, and `JWT_SECRET` are
operator-supplied values.

`OPERATOR_SIGNER_KEY_FILE` is required for issuance and administrative API
transactions. Start with an operator-readable, test-only mode-`0400` or
mode-`0600` source file containing exactly one `0x`-prefixed 32-byte private
key. Its derived address must equal the `OPERATOR_SIGNER_ADDRESS` used in the
contract ceremony; it must not be the temporary deployment key. Validate the
source without printing the key:

```bash
DEPLOYER_SIGNER_KEY_FILE=/secure/operator/terraqura-operator.key \
  env -u PRIVATE_KEY pnpm contracts:signer-key:check
```

The check prints the derived public address. Compare that address to the
finalized checkpoint before starting the API. The image runs as numeric
UID/GID `1001`; file-backed Compose secrets cannot remap host ownership. Create
a separate container-readable copy, keep its parent directory restricted, and
point the evaluation env at that copy:

```bash
sudo install -o 1001 -g 1001 -m 0400 \
  /secure/operator/terraqura-operator.key \
  /secure/operator/terraqura-api-operator.key
sudo cmp --silent \
  /secure/operator/terraqura-operator.key \
  /secure/operator/terraqura-api-operator.key
```

Set:

```dotenv
OPERATOR_SIGNER_KEY_FILE=/secure/operator/terraqura-api-operator.key
```

Validate, build, migrate, and start the exact evaluation stack:

```bash
test "$PUBLIC_HOST" = "93.127.132.52"
test "$SIWE_DOMAIN" = "93.127.132.52:3007"
test "$CORS_ORIGIN" = "http://93.127.132.52:3007"
test "$WEB_PUBLIC_ORIGIN" = "http://93.127.132.52:3007"
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml config --quiet
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml build
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml run --rm --no-deps \
  api sh -eu -c 'test -r "$OPERATOR_SIGNER_KEY_FILE"'
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml up -d postgres
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml run --rm \
  api node dist/scripts/migrate.js
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml up -d api web
docker compose \
  --env-file /secure/operator/terraqura-public-testnet-evaluation.env \
  -f docker-compose.public-testnet-evaluation.yml ps
```

Verify the direct-IP endpoints:

```bash
curl --fail --silent --show-error \
  http://93.127.132.52:4000/v1/health/ready
curl --fail --silent --show-error http://93.127.132.52:3007/
curl --fail --silent --show-error \
  http://93.127.132.52:3007/api/terraqura/v1/health/ready
```

This profile fixes `TERRAQURA_DEPLOYMENT_PROFILE` to
`public-testnet-evaluation`, keeps the API in production runtime mode, disables
API docs, preserves signer-file and admin-wallet requirements, and permits
`KYC_PROVIDER=disabled` only for this explicit profile. Disabled KYC makes the
external KYC endpoints unavailable; it does not bypass the contracts' KYC or
sanctions controls. Transaction testing therefore requires already approved
test wallets or a separately authorized compliance transaction. A blank
explorer URL is supported and produces no explorer links.

API startup revalidates the mounted signer file type, mode, readability, and
key format before it listens. A signer mount problem therefore fails startup
instead of surfacing during the first issuance transaction.

The browser labels plaintext RPC use and withholds wallet providers until chain
ID `7332` and anchor block `450000` are verified. Never use real assets,
production credentials, or this Compose file for a production service.

## 9. Database and migration

Do not point the candidate at an old TerraQura database by default. Before reuse:

1. stop old writes;
2. checksum a logical dump and provider snapshot;
3. record old SHA, schema, chain ID, and contract addresses;
4. review stored identifiers/state against the five-proxy candidate;
5. restore into isolation and run migration plus smoke tests;
6. obtain explicit data-owner approval.

Without that review, create a fresh PostgreSQL 16 database. Never expose 5432.
For `docker-compose.production.yml`, use the same numeric UID/GID `1001`,
mode-`0400` container signer copy described above; a host-operator-owned
mode-`0400` source file is not readable by the image runtime user.

```bash
install -d -m 0700 /secure/operator
install -m 0600 deploy/terraqura.production.env.example \
  /secure/operator/terraqura-production.env
# Fill required values and use the UID/GID-1001, mode-0400 signer copy.
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml config --quiet
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml build
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml run --rm --no-deps \
  api sh -eu -c 'test -r "$OPERATOR_SIGNER_KEY_FILE"'
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml up -d postgres
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml run --rm \
  api node dist/scripts/migrate.js
```

For a separate API service:

```bash
pnpm build:api
pnpm db:migrate
pnpm start:api
```

Migrate before new code receives traffic. Preserve migration output.

## 10. API and web hosting

Compose runs PostgreSQL only on its private network, API on
`127.0.0.1:4000`, and web on `127.0.0.1:3007`.

The separate evaluation Compose build propagates its explicit profile,
plaintext-RPC acknowledgement, and both `AETHELRED_NETWORK_ANCHOR_*` fields
into the API and browser bundle. The production Compose file fixes both API and
web to the production profile and rejects plaintext RPC.

```bash
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml up -d api web
docker compose --env-file /secure/operator/terraqura-production.env \
  -f docker-compose.production.yml ps
```

For a separate web process:

```bash
pnpm build:web
PORT=3007 pnpm start:web
```

Bind services to loopback/private networks. Do not expose 3007, 4000, or 5432.

## 11. TLS reverse proxy

Terminate organization-managed TLS at the proxy:

- `https://terraqura.example` to `http://127.0.0.1:3007`;
- `https://api.terraqura.example` to `http://127.0.0.1:4000`.

Require TLS 1.2+, redirect HTTP, preserve host, set `X-Forwarded-Proto https`,
and configure the exact trusted hop count. Use request limits compatible with
the gateway (2 MiB, 15 seconds). Keep API docs disabled or access-controlled.
Never enable `TERRAQURA_ALLOW_INSECURE_UPSTREAM` in production.

## 12. Health and smoke checks

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

## 13. Recovery and rollback

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
