# Hyperscale Authentication & Bot Defense Architecture (1,000,000 Concurrent Logins)

Designed for a high-concurrency music streaming service (Spotify/Netflix-scale).

---

## 1. Threat Model Matrix

| Problem | Attack Vector / Mechanism | Impact | Architectural Solution |
| :--- | :--- | :--- | :--- |
| **Thundering Herd / CPU Exhaustion** | 1,000,000 users hit `/login` within a 2-5 minute flash event (push notification, concert drop). | Node.js event loop blocks on password hashing (Argon2/Bcrypt); CPU hits 100%; DB connection pool exhausted; gateway 504 timeouts. | Worker thread pools for hashing; Redis queue / Cloudflare Waiting Room; horizontal auto-scaling with HPA; connection pooling (PgBouncer). |
| **Credential Stuffing** | Botnets feed leaked database dumps (millions of `email:password` combos) via distributed residential proxies. | Account takeovers (ATOs), stream theft, ruined recommendations, massive DB read pressure. | Proof-of-Work (mPoW) challenge; IP velocity limits; device fingerprinting; HaveIBeenPwned API check on password set; risk scoring. |
| **Distributed Brute Force** | Slow-and-low password guessing against targeted VIP or high-tier accounts across rotating IPs. | Target account compromise without triggering single-IP rate limiters. | Dual-axis rate limiting (per-IP + per-username sliding window); progressive tarpitting (exponential delay); account defense without hard lockout. |
| **Account Denial Attack (Lockout Abuse)** | Attacker deliberately sends 5 wrong passwords for legitimate usernames across the platform. | Mass denial of service for real paying subscribers whose accounts get locked out. | Never hard-lock accounts by default. Use adaptive challenges (PoW, CAPTCHA, MFA step-up, magic email link) instead of account locks. |
| **Token Theft & Replay (MitM / Malware)** | Infostealer malware steals browser tokens or attacker intercepts non-DPoP Bearer tokens. | Session hijacking, unauthorized streaming, private playlist tampering. | Refresh Token Rotation (RTR) with family reuse detection; DPoP (RFC 9449) device binding; short-lived access tokens (10m); `httpOnly; Secure; SameSite=Lax`. |
| **Fake Stream Farming** | Automated headless browser scripts generate synthetic song streams to divert royalties. | Platform fraud, advertising fraud, DMCA disputes, corrupted chart data. | WebAudio/Canvas hardware fingerprinting; proof-of-work on session handshake; WebSocket stream heartbeat verification; max 1 active stream lease. |
| **SMS / OTP Pumping (Toll Fraud)** | Bots trigger thousands of phone verification SMS codes to premium rate numbers owned by attackers. | Tens of thousands of dollars in carrier fees within hours. | Strict rate limits on OTP generation; CAPTCHA on phone entry; carrier risk lookup (block VoIP/virtual numbers); cost circuit-breakers. |
| **Database Pool Exhaustion** | 100,000 incoming requests open direct PostgreSQL connections simultaneously. | `FATAL: remaining connection slots are reserved`; total backend crash. | PgBouncer in transaction mode; read replicas for user existence checks; Redis layer for rate limits and credentials cache. |

---

## 2. High-Level Architecture (ASCII)

```
                            [ 1,000,000 Concurrent Clients ]
                               (Web, iOS, Android, Desktop)
                                             │
                                             ▼
                 ┌───────────────────────────────────────────────────────┐
                 │        EDGE CDN & ANYCAST WAF (Cloudflare / AWS)      │
                 │  - Anycast BGP routing (absorbs L3/L4 SYN floods)     │
                 │  - TLS 1.3 Termination (0-RTT resumption)            │
                 │  - DDoS Shield & Bot Score Filtering                  │
                 │  - Virtual Waiting Room (Traffic Spreader Queue)      │
                 └───────────────────────────┬───────────────────────────┘
                                             │ Cleaned HTTPS
                                             ▼
                 ┌───────────────────────────────────────────────────────┐
                 │       API GATEWAY / LOAD BALANCER (Envoy / ALB)       │
                 │  - Layer 7 Route Splitting                            │
                 │  - Edge Token Verification (Public JWKS verify)       │
                 │  - IP/Header Sanitization (CF-Connecting-IP)          │
                 └──────────────┬─────────────────────────┬──────────────┘
                                │                         │
         Challenge / Auth Flow  ▼                         ▼  Stream Heartbeats
┌──────────────────────────────────────────┐    ┌──────────────────────────────────┐
│         AUTH SERVICE CLUSTER             │    │       STREAMING SERVICE          │
│  (Node.js Cluster / Go / Rust Workers)   │    │  (Tracks 1 active stream/user)   │
│  - Step 1: Challenge Nonce & PoW Gen     │    └─────────────────┬────────────────┘
│  - Step 2: Risk Scoring & PoW Verify     │                      │
│  - Step 3: Offloaded Argon2id (Threads)  │                      │
│  - Issues: Access JWT + Refresh Token    │                      │
└──────┬──────────────────────┬────────────┘                      │
       │                      │                                   │
       ▼                      ▼                                   ▼
┌──────────────┐     ┌──────────────────┐               ┌──────────────────┐
│ REDIS CLUSTER│     │   PgBouncer Pool │               │  STREAM LEASE    │
│  (In-Memory) │     │(Transaction Mode)│               │  REDIS CLUSTER   │
│ - Sliding    │     └────────┬─────────┘               │ - 1 session play │
│   Window     │              │                         │   enforcement    │
│ - Nonces     │              ▼                         └──────────────────┘
│ - Token      │     ┌──────────────────┐
│   Blacklist  │     │  POSTGRESQL DB   │
│ - Stream     │     │  - Read Replica  │
│   Leases     │     │  - Master DB     │
└──────────────┘     └──────────────────┘
```

---

## 3. Deep Dive: Login at 1,000,000 Scale

### Bottlenecks and Physical Limits
1. **CPU from Password Hashing**:
   - Argon2id with memory cost 64MB and time cost 3 iterations takes ~150ms per core.
   - If 1,000,000 requests hit simultaneously, hashing them requires **150,000 CPU-seconds**. On a 64-core server, hashing alone would take **2,343 seconds (39 minutes)** of pure 100% CPU saturation.
   - **Resolution**:
     - Offload hashing to dedicated worker thread pools or an isolated Auth Microservice autoscaling cluster.
     - Tune cost parameters: `m=19456 (19MB), t=2, p=1` (OWASP minimum for high-throughput backends) yielding ~45ms per hash.
     - Never hash passwords on the main event loop thread in Node.js.
2. **Database Connection Starvation**:
   - PostgreSQL allocates ~10MB RAM per direct backend process. 10,000 direct connections would consume 100GB RAM and collapse kernel scheduling.
   - **Resolution**: PgBouncer transaction pooling capping connections to the database engine at 200-300 connections, while serving 50,000 incoming clients.
3. **Thundering Herd & Virtual Waiting Room**:
   - When a massive traffic spike occurs, clients enter a Cloudflare or Redis-backed Virtual Waiting Room.
   - Server returns HTTP 202 Accepted with a signed Queue Ticket (`{"queue_position": 14200, "estimated_wait_seconds": 4, "poll_after_ms": 2000}`).
   - Admission is controlled at an exact ingestion rate (e.g., 5,000 logins/second), completely protecting the database.

---

## 4. Bot vs. Real User Detection Engine

### Risk Scoring Framework (0 - 100 Scale)
Every login attempt receives an instantaneous calculated risk score:

| Signal Factor | Weight | Condition Triggered |
| :--- | :--- | :--- |
| **IP Velocity** | +30 | >10 login attempts across different accounts from same `/24` subnet in 60s. |
| **Device Fingerprint** | +25 | Missing canvas hash, headless Chrome WebGL vendor, or User-Agent mismatch. |
| **Impossible Travel** | +40 | Login from London 12 minutes after a valid session was active in Tokyo. |
| **Failed Attempt Ratio** | +20 | Account has had >4 failed passwords in the past 15 minutes. |
| **Proof-of-Work Latency** | +15 | PoW puzzle solved in <5ms (indicates precomputation) or >30s (timeout). |
| **Known Datacenter IP** | +35 | IP belongs to AWS, DigitalOcean, Hetzner, or Tor exit node. |

#### Decision Engine:
- **Score 0 - 39 (Low Risk)**: Issue tokens immediately.
- **Score 40 - 74 (Medium Risk)**: Require interactive Turnstile / WebAuthn biometric confirmation or send 1-click email Magic Link.
- **Score 75 - 100 (High Risk)**: Reject request immediately (`HTTP 403 Forbidden - Security Challenge Failed`) and ban IP subnet for 1 hour.

---

## 5. The 3-Step Handshake Protocol

### A. Network-Level Hardening
- **SYN Flood Protection**: SYN cookies enabled (`net.ipv4.tcp_syncookies = 1`). The kernel responds to SYN packets with an engineered cryptographic Sequence Number without allocating state buffers in memory until the ACK arrives.
- **TLS 1.3**: Reduces handshake from 2 round-trips (RTT) to 1 RTT. Pre-shared keys (PSK) allow 0-RTT session resumption for returning mobile apps.

### B. Application-Level 3-Step Handshake Flow

```
Client (App/Web)                     Auth Server (Edge)                 Redis / DB
       │                                     │                              │
[Step 1: Request Challenge]                  │                              │
       ├──── POST /v1/auth/challenge ───────>│                              │
       │     { client_id, device_meta }      │── Generate Nonce & PoW ─────>│ Store Nonce
       │<─── 200 OK (Challenge Nonce) ───────┤   (Expires in 60s)           │ (TTL: 60s)
       │     { nonce, difficulty, hmac }     │                              │
       │                                     │                              │
[Step 2: Client Computes PoW]                │                              │
       │  (Finds hash with N leading zeroes) │                              │
       │                                     │                              │
[Step 3: Submit Solution & Credentials]      │                              │
       ├──── POST /v1/auth/login ───────────>│                              │
       │     { email, password, nonce,       │── Validate & Burn Nonce ────>│ Atomically DEL
       │       pow_solution, device_fp }     │── Check Risk Score & IP ────>│ Check velocity
       │                                     │── Verify Argon2id Hash ─────>│ Read User Hash
       │<─── 200 OK (Tokens Issued) ─────────┤── Store Refresh Token ──────>│ Write Session
       │     { access_token, refresh_token } │                              │
```

---

## 6. Token Architecture & Refresh Token Rotation (RTR)

### Token Lifespans & Storage
- **Access Token (JWT)**:
  - Expiration: **10 minutes**.
  - Signed with: **RS256** or **EdDSA (Ed25519)** asymmetric keypair.
  - Contains: `sub` (userId), `jti` (unique UUID), `roles`, `token_family`, `exp`.
  - Storage: In-memory JavaScript state for SPAs; Secure Keystore/Keyring for iOS/Android.
- **Refresh Token (Opaque UUIDv4)**:
  - Expiration: **14 days**.
  - Storage in Browser: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/auth`.
  - Storage in Server: SHA-256 hash stored in PostgreSQL with family hierarchy.

### Automatic Reuse Detection (The "Breach Alarm")
1. Client sends `Refresh Token A` to get new tokens.
2. Server verifies `A` is valid. Server invalidates `A` and issues `Refresh Token B`.
3. If an attacker intercepts `Refresh Token A` and submits it later:
   - Server detects `Refresh Token A` has **already been used**.
   - **Trigger Breach Alarm**: Server revokes **Token B** and the **entire token family**, logging out all sessions on all devices for that user.
   - An alert email is dispatched: *"Your session was terminated due to a detected compromise."*

---

## 7. Spotify-Specific Feature: Single Active Audio Stream Lease

To prevent account-sharing farms and multiple devices streaming simultaneously on one subscription:
- Every active player maintains a 15-second heartbeat ping over WebSocket or `POST /api/v1/stream/lease`.
- Redis Key: `stream_lease:{user_id} -> { device_id: "iphone_15", leased_at: 1730000000 }` with TTL of 30 seconds.
- If the user starts streaming on desktop:
  1. Desktop acquires the lease key with `SET stream_lease:{user_id} {desktop_id} EX 30`.
  2. iPhone's next 15s heartbeat receives: `{"status": "displaced", "playing_on": "MacBook Pro"}`.
  3. iPhone client immediately pauses playback and displays the banner: *"Listening on MacBook Pro"*.

---

## 8. Database Schema (PostgreSQL)

```sql
-- Enable cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Core Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    mfa_secret VARCHAR(64) NULL,
    risk_level VARCHAR(20) DEFAULT 'LOW' NOT NULL,
    security_stamp UUID DEFAULT gen_random_uuid() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_users_email ON users(email);

-- 2. Token Families & Refresh Tokens (Supports RTR & Reuse Detection)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_family UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 of the token string
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(128) NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NULL,
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    replaced_by UUID NULL, -- ID of the replacement token
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 3. Login Audit Log (For Anomaly Detection & ML Feeds)
CREATE TABLE login_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    attempted_email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NULL,
    device_fingerprint VARCHAR(64) NULL,
    country_code VARCHAR(4) NULL,
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'BAD_PASSWORD', 'CHALLENGE_FAILED', 'RATE_LIMITED'
    risk_score INT DEFAULT 0 NOT NULL,
    failure_reason VARCHAR(100) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_login_audit_ip_time ON login_audit_log(ip_address, created_at DESC);
CREATE INDEX idx_login_audit_email_time ON login_audit_log(attempted_email, created_at DESC);

-- 4. Global Blocked IP / CIDR Table
CREATE TABLE blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_network CIDR NOT NULL UNIQUE,
    reason VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_blocked_ips_network ON blocked_ips USING gist (ip_network inet_ops);
```

---

## 9. Redis Key Pattern Architecture

| Key Pattern | Data Structure | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `rl:ip:{ip_address}` | Sorted Set (ZSET) | 120s | Sliding-window request counter per IP. |
| `rl:account:{email_sha256}` | Sorted Set (ZSET) | 900s | Sliding-window failed login counter per account. |
| `challenge:{nonce}` | String (Hash) | 60s | Nonce state, difficulty target, and device metadata. |
| `blacklist:jti:{token_jti}` | String ("1") | Exp of JWT | Revoked short-lived access tokens. |
| `user:revoked_before:{userId}` | String (Unix TS) | 30 days | Invalidation barrier: all JWTs issued before TS are denied. |
| `stream_lease:{userId}` | Hash | 30s | Enforces Spotify single-active-device streaming rule. |

---

## 10. Implementation Code (Production-Grade Node.js)

The complete working reference implementation is organized under `spotify-search/auth/`:
- `challengeService.js`: Nonce generation, HMAC signing, PoW validation.
- `tokenManager.js`: JWT signing (RS256/ES256), Refresh Token Rotation, family revocation.
- `rateLimiter.js`: Redis sliding-window algorithm with local memory fallback.
- `riskScorer.js`: Real-time signal evaluator (velocity, fingerprint, impossible travel).
- `authRoutes.js`: Express router tying together the 3-step handshake.

---

## 11. k6 Load-Testing Simulation Plan (1,000,000 Users)

The load test simulates a sudden concert drop / marketing spike:
- **Stages**:
  1. Ramp up from 0 to 5,000 virtual users (VUs) over 2 minutes.
  2. Spike to 25,000 concurrent VUs over 3 minutes (simulating 1M attempts over the period).
  3. Sustained stress test for 5 minutes.
  4. Ramp down to 0.
- **Traffic Composition**:
  - 85% Legitimate Users: Complete Step 1 Challenge -> Compute PoW -> Successful Login.
  - 10% Credential Stuffing Bots: Random emails/passwords, fail PoW or fail credentials.
  - 5% High-Frequency Brute Force Bots: Rapid requests without waiting for challenge.
- **Target SLO Metrics**:
  - `http_req_duration`: p95 < 250ms, p99 < 500ms
  - `http_req_failed`: < 0.05% (excluding intentional 401/429 bot rejections)
  - `throughput`: >= 15,000 requests/sec across cluster.

---

## 12. Prioritized Roadmap & Engineering Trade-Offs

### Phase 1: Day 1 (Startup / MVP Scale)
- Switch to PBKDF2 (100k rounds) or Argon2id with controlled cost.
- Implement Redis-backed sliding-window rate limiting on `/login` and `/register`.
- Use `httpOnly`, `Secure`, `SameSite=Lax` cookies for sessions/tokens.
- Return generic error messages (*"Invalid email or password"*) to prevent username enumeration.

### Phase 2: Growth Stage (10k - 100k Users)
- Implement Refresh Token Rotation (RTR) with family revocation on reuse.
- Deploy PgBouncer in front of PostgreSQL.
- Add Proof-of-Work challenge step to login forms for non-browser/high-velocity IPs.
- Add single-active-stream lease enforcement using Redis keys.

### Phase 3: Hyperscale (1M+ Users)
- Cloudflare Waiting Room / Anycast Layer 7 rate limits.
- Separate Auth Service into dedicated autoscaling cluster with CPU affinity for Argon2.
- Dual-region database read replicas with active-active Redis clusters.
- DPoP (Demonstrating Proof-of-Possession) token binding.
