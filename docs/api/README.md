# TerraQura API Reference

> REST API for the TerraQura carbon credit platform. Built on Fastify 4.26 with TypeScript.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:4000` |
| Testnet | `https://api-testnet.terraqura.com` |
| Mainnet | `https://api.terraqura.com` |

Interactive Swagger documentation is served at `/docs` on every running instance.

---

## Authentication

TerraQura uses **Sign-In with Ethereum (SIWE)** for wallet-based authentication, issuing **JWT bearer tokens** for subsequent requests.

### Flow

1. Call `GET /v1/auth/nonce` to obtain a one-time nonce (valid for 10 minutes).
2. Construct a SIWE message incorporating the nonce and sign it with the connected wallet.
3. Submit the message and signature to `POST /v1/auth/verify` to receive a JWT.
4. Include the JWT in the `Authorization: Bearer <token>` header for all authenticated requests.

JWTs expire after 24 hours by default (configurable via `JWT_EXPIRES_IN`).

### Sensor API Keys

IoT sensor endpoints accept an `X-Sensor-API-Key` header instead of a bearer token. API keys are scoped to a specific DAC unit and managed via the API Keys module.

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| Global | 100 requests per minute per IP |
| Sensor ingestion | Subject to per-key throttling |

Rate-limited responses return HTTP `429` with a `Retry-After` header.

---

## Common Response Format

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token"
  }
}
```

---

## Pagination

List endpoints accept `page` (1-indexed) and `limit` (default 20, max 100) query parameters and return:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

---

## Route Modules

### 1. Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/health` | None | Overall system health |

**Response `200`**:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": true,
    "blockchain": true,
    "redis": true
  }
}
```

---

### 2. Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/auth/nonce` | None | Get SIWE nonce |
| `POST` | `/v1/auth/verify` | None | Verify SIWE signature, receive JWT |
| `GET` | `/v1/auth/session` | Bearer | Get current session |

**`GET /v1/auth/nonce`** response:

```json
{
  "nonce": "a1b2c3d4e5f6...",
  "expiresAt": "2026-03-17T12:10:00.000Z"
}
```

**`POST /v1/auth/verify`** request:

```json
{
  "message": "<SIWE message string>",
  "signature": "0x..."
}
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "address": "0xabc...def",
    "chainId": 78432
  }
}
```

**Error codes**: `401 UNAUTHORIZED` -- invalid signature, expired nonce, or domain mismatch.

---

### 3. DAC Units

Manage Direct Air Capture facility registrations.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/dac-units` | Bearer | List all DAC units (filterable by status) |
| `GET` | `/v1/dac-units/:id` | Bearer | Get DAC unit by ID |
| `POST` | `/v1/dac-units` | Bearer | Register a new DAC unit |
| `PUT` | `/v1/dac-units/:id` | Bearer | Update DAC unit |
| `POST` | `/v1/dac-units/:id/whitelist` | Bearer (Admin) | Whitelist a DAC unit on-chain |

**`POST /v1/dac-units`** request:

```json
{
  "name": "Abu Dhabi DAC-1",
  "latitude": 24.4539,
  "longitude": 54.3773,
  "countryCode": "AE",
  "region": "Abu Dhabi",
  "capacityTonnesPerYear": 5000,
  "technologyType": "solid-sorbent"
}
```

**Query parameters** for list: `status` (`pending`, `active`, `suspended`, `decommissioned`), `page`, `limit`.

---

### 4. Sensors

Ingest IoT telemetry from DAC units. Authenticated via `X-Sensor-API-Key`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/sensors/readings` | API Key | Submit a sensor reading |
| `POST` | `/v1/sensors/readings/batch` | API Key | Submit batch readings |
| `GET` | `/v1/sensors/readings` | Bearer | Query historical readings |
| `GET` | `/v1/sensors/:sensorId/status` | Bearer | Get sensor health status |

**`POST /v1/sensors/readings`** request:

```json
{
  "sensorId": "sensor-001",
  "timestamp": "2026-03-17T10:00:00Z",
  "co2CaptureRateKgHour": 12.5,
  "energyConsumptionKwh": 3.2,
  "co2PurityPercentage": 95.3,
  "ambientTemperatureC": 42.1,
  "ambientHumidityPercent": 28.0,
  "atmosphericCo2Ppm": 421
}
```

**Validation thresholds** (matching smart contract constants):
- Minimum efficiency: 200 kWh/tonne CO2
- Maximum efficiency: 600 kWh/tonne CO2
- Minimum purity: 90%

Readings outside thresholds are flagged with anomaly reasons and excluded from verification.

---

### 5. Verification

Trigger and monitor the Proof-of-Physics verification pipeline.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/verification` | Bearer | Request verification for a time period |
| `GET` | `/v1/verification` | Bearer | List verifications |
| `GET` | `/v1/verification/:id` | Bearer | Get verification details |

**`POST /v1/verification`** request:

```json
{
  "dacUnitId": "dac_abc123",
  "startTime": "2026-03-01T00:00:00Z",
  "endTime": "2026-03-15T23:59:59Z"
}
```

**Verification pipeline phases**:

1. **Source Check** -- Validates that sufficient sensor readings exist and data hashes match.
2. **Logic Check** -- Calculates kWh/tonne efficiency and efficiency factor; rejects readings outside 200-600 kWh/tonne.
3. **Mint Check** -- Confirms credits-to-mint calculation and prepares on-chain transaction.

**Statuses**: `pending`, `source_check`, `logic_check`, `mint_ready`, `completed`, `failed`.

---

### 6. Credits

Manage the lifecycle of tokenized carbon credits (ERC-1155).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/credits` | Bearer | List credits (filterable) |
| `GET` | `/v1/credits/:id` | Bearer | Get credit by ID |
| `POST` | `/v1/credits/mint` | Bearer | Mint credits from a completed verification |
| `POST` | `/v1/credits/:id/retire` | Bearer | Retire credits permanently |
| `GET` | `/v1/credits/:id/provenance` | Bearer | Get provenance chain |

**`POST /v1/credits/mint`** request:

```json
{
  "verificationId": "ver_abc123",
  "recipientWallet": "0x1234...abcd",
  "ipfsMetadataCid": "QmXyz...",
  "arweaveTxId": "ar_tx_123"
}
```

**`POST /v1/credits/:id/retire`** request:

```json
{
  "amount": 100,
  "reason": "Voluntary offset for Q1 2026 emissions"
}
```

---

### 7. Marketplace

Peer-to-peer carbon credit trading: listings, offers, and purchases.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/marketplace/listings` | Bearer | List active marketplace listings |
| `GET` | `/v1/marketplace/listings/:id` | Bearer | Get listing details |
| `POST` | `/v1/marketplace/listings` | Bearer | Create a new listing |
| `POST` | `/v1/marketplace/listings/:id/purchase` | Bearer | Purchase credits from a listing |
| `DELETE` | `/v1/marketplace/listings/:id` | Bearer | Cancel a listing |
| `GET` | `/v1/marketplace/offers` | Bearer | List offers |
| `POST` | `/v1/marketplace/offers` | Bearer | Create a buy offer |
| `POST` | `/v1/marketplace/offers/:id/accept` | Bearer | Accept an offer |
| `DELETE` | `/v1/marketplace/offers/:id` | Bearer | Cancel an offer |
| `GET` | `/v1/marketplace/stats` | Bearer | Market statistics |

**`POST /v1/marketplace/listings`** request:

```json
{
  "tokenId": "42",
  "amount": 500,
  "pricePerUnit": "1000000000000000000",
  "minPurchaseAmount": 10,
  "durationDays": 30
}
```

**`POST /v1/marketplace/offers`** request:

```json
{
  "tokenId": "42",
  "amount": 200,
  "pricePerUnit": "950000000000000000",
  "durationDays": 7
}
```

---

### 8. KYC

Identity verification via Sumsub integration with tiered access control.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/kyc/initiate` | Bearer | Start KYC verification |
| `GET` | `/v1/kyc/status` | Bearer | Get current KYC status |
| `GET` | `/v1/kyc/status/:walletAddress` | Bearer (Admin) | Admin: check KYC for any wallet |
| `POST` | `/v1/kyc/webhook` | Webhook Secret | Sumsub status callback |

**`POST /v1/kyc/initiate`** request:

```json
{
  "walletAddress": "0xabc...def",
  "email": "operator@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "country": "AE"
}
```

**KYC tiers**: See [Compliance documentation](../compliance/) for the full tier structure.

---

### 9. Gasless

Meta-transaction relay for gasless user experience (ERC-2771).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/gasless/nonce/:address` | Bearer | Get current forwarder nonce |
| `POST` | `/v1/gasless/build` | Bearer | Build a meta-transaction request |
| `POST` | `/v1/gasless/relay` | Bearer | Relay a signed meta-transaction |
| `GET` | `/v1/gasless/status/:txHash` | Bearer | Check relay transaction status |

**`POST /v1/gasless/relay`** request:

```json
{
  "request": {
    "from": "0xabc...def",
    "to": "0x123...456",
    "value": "0",
    "gas": "200000",
    "nonce": "5",
    "deadline": 1710700800,
    "data": "0xa9059cbb..."
  },
  "signature": "0x..."
}
```

---

### 10. Webhooks

Register HTTP webhooks to receive real-time event notifications.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/webhooks` | Bearer | List registered webhooks |
| `POST` | `/v1/webhooks` | Bearer | Register a new webhook |
| `GET` | `/v1/webhooks/:id` | Bearer | Get webhook details |
| `PUT` | `/v1/webhooks/:id` | Bearer | Update a webhook |
| `DELETE` | `/v1/webhooks/:id` | Bearer | Delete a webhook |
| `GET` | `/v1/webhooks/:id/deliveries` | Bearer | List delivery attempts |
| `POST` | `/v1/webhooks/:id/test` | Bearer | Send a test event |

**`POST /v1/webhooks`** request:

```json
{
  "url": "https://example.com/hooks/terraqura",
  "events": ["credit.minted", "credit.retired", "verification.completed"],
  "description": "Production credit events",
  "retryConfig": {
    "maxRetries": 3,
    "backoffMultiplierMs": 1000
  }
}
```

#### Webhook Event Types

| Event | Trigger |
|-------|---------|
| `credit.minted` | New carbon credits minted from verification |
| `credit.retired` | Credits permanently retired |
| `credit.transferred` | Credits transferred between wallets |
| `listing.created` | New marketplace listing published |
| `listing.purchased` | Credits purchased from a listing |
| `verification.completed` | Proof-of-Physics verification completed |
| `kyc.updated` | KYC status changed |

All webhook payloads are signed with HMAC-SHA256 using the webhook's signing key, delivered in the `X-TerraQura-Signature` header.

---

### 11. Activity

Immutable audit log of all platform actions.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/activity` | Bearer | Query activity log (filterable) |
| `GET` | `/v1/activity/export` | Bearer | Export activity as CSV |

**Query parameters**: `action` (enum), `resourceType`, `startDate`, `endDate`, `page`, `limit`.

**Action types**: `credit.minted`, `credit.retired`, `credit.transferred`, `listing.created`, `listing.cancelled`, `listing.purchased`, `offer.created`, `offer.accepted`, `offer.cancelled`, `verification.started`, `verification.completed`, `verification.failed`, `kyc.submitted`, `kyc.approved`, `kyc.rejected`, `webhook.registered`, `webhook.deleted`, `api_key.created`, `api_key.revoked`, `sensor.reading_submitted`, `dac_unit.registered`, `dac_unit.updated`.

**Resource types**: `credit`, `listing`, `offer`, `verification`, `kyc`, `webhook`, `api_key`, `sensor`, `dac_unit`.

---

### 12. Analytics

Portfolio, protocol, and impact analytics.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/analytics/portfolio` | Bearer | User portfolio summary |
| `GET` | `/v1/analytics/protocol` | Bearer | Protocol-wide statistics |
| `GET` | `/v1/analytics/impact` | Bearer | Environmental impact metrics |
| `GET` | `/v1/analytics/price-history` | Bearer | Historical credit pricing |

**`GET /v1/analytics/protocol`** response:

```json
{
  "totalCreditsIssued": 125000,
  "totalCreditsRetired": 42000,
  "totalCo2CapturedKg": 125000000,
  "activeListings": 87,
  "totalVolumeTraded": "4500000000000000000000",
  "averagePricePerCredit": "18500000000000000000",
  "uniqueHolders": 342,
  "activeDacUnits": 12
}
```

---

### 13. API Keys

Manage programmatic API keys for sensor integration and third-party access.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/api-keys` | Bearer | List API keys |
| `POST` | `/v1/api-keys` | Bearer | Create a new API key |
| `GET` | `/v1/api-keys/:id` | Bearer | Get API key metadata |
| `PUT` | `/v1/api-keys/:id` | Bearer | Update API key |
| `DELETE` | `/v1/api-keys/:id` | Bearer | Revoke an API key |

**Key types**: `sensor`, `read-only`, `full-access`.

**Permissions**: `credits:read`, `credits:write`, `marketplace:read`, `marketplace:write`, `sensors:write`, `verification:read`, `analytics:read`, `activity:read`, `webhooks:manage`.

**`POST /v1/api-keys`** request:

```json
{
  "name": "DAC Unit Alpha Sensor",
  "type": "sensor",
  "description": "Ingestion key for Abu Dhabi facility",
  "permissions": ["sensors:write"],
  "expiresInDays": 90
}
```

---

### 14. Retirement (Smart Contract Only)

Retirement and certificate issuance are currently managed directly via the `CarbonRetirement` and `RetirementCertificate` smart contracts. Credit retirement can also be triggered through the `POST /v1/credits/:id/retire` endpoint in the Credits module. A dedicated `/v1/retirement` route module is planned for a future release.

---

### 15. Auctions (Smart Contract Only)

Batch auctions are managed by the `CarbonBatchAuction` smart contract. A dedicated `/v1/auctions` route module for REST-based auction participation is planned for a future release.

---

## Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| `400` | `VALIDATION_ERROR` | Request body or query parameter validation failed |
| `401` | `UNAUTHORIZED` | Missing or invalid bearer token |
| `403` | `FORBIDDEN` | Insufficient permissions or KYC tier |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Duplicate resource or state conflict |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
