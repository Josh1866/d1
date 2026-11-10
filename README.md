# D1 Music — Phase 2 Development MVP

A runnable **Next.js + NestJS + PostgreSQL** music streaming starter for D1.co.za.

## Included

- Responsive dark listener website, search, playback with byte-range seeking
- Listener and artist registration/login (bcrypt password hashing, JWT)
- Artist upload form (MP3/M4A/WAV/FLAC/OGG up to 25MB) and release review
- Admin moderation dashboard and basic statistics
- User playlists and track additions
- PostgreSQL schema via Prisma and Docker Compose database

## Local installation (Node.js 20+ and Docker)

```bash
cp .env.example .env
# IMPORTANT: edit .env and set strong JWT_SECRET and ADMIN_PASSWORD
npm install
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3000**. API: **http://localhost:4000/v1/health**.

The admin login uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` **you set in `.env`** before seeding. There is deliberately no hard-coded admin password. Artist registration is available from Sign up → Artist. Uploads are pending until approved in Admin.

## Deployment notes

This is a **local development MVP, not a production-ready streaming service**. Before a public deployment:

1. Replace local disk uploads with private object storage, CDN, media transcoding and expiring playback URLs.
2. Require recording and publishing licenses, metadata and artist identity verification. The MVP's simple rights declaration is not a licensing system.
3. Add email verification, password reset, MFA for admins, account lockout, audit logs and robust rate limits.
4. Add stronger file scanning and actual audio decoding/inspection, plus moderation, takedown and abuse workflows.
5. Use HttpOnly secure cookies or a BFF rather than localStorage tokens, TLS, a secrets manager and backups.
6. Implement financial ledger, rights-aware royalty calculations, payments and payouts in a later phase.
7. Protect streaming entitlements, add anti-scraping, fraud detection, load tests and monitoring.
8. Add playlist rename/delete, track metadata editing, cover artwork upload and full release management.
9. Use separate database credentials, network controls and migration strategy for production.

## Notes

- Local uploads are stored in `apps/api/uploads/` and excluded from Git.
- Streaming is publicly accessible for **approved** tracks; no subscription gate is implemented.
- No copyrighted demo music is bundled.
- This MVP does **not** claim Spotify catalogue access or payment/royalty support.
- The API's upload MIME/signature checks are basic development safeguards, not a substitute for content scanning and transcoding.
- For artist uploads, use a browser-supported audio file. Playback format support varies by browser.


## Phase 2: artist monetization prototype

This release adds **DEMO-ONLY** artist support interactions. On approved tracks, signed-in users can simulate a R15 purchase or a tip (R1–R1000). The artist sees totals and transaction history in Artist Studio; admins see transaction records. These are *not* charges, royalties, payment confirmations, or withdrawable earnings. No payment credentials are collected, no bank transfers occur, and a demo purchase does not grant a licensed download.

The database adds `DemoTransaction` with relations to users, artists and tracks. After updating from Phase 1, run `npm run db:generate` and `npm run db:migrate` to apply the schema migration locally. Never run destructive migration commands on production without a backup.

### Before real monetization

- Integrate a payment provider using server-verified webhooks and idempotency keys.
- Implement immutable double-entry ledger, tax/fee accounting, refunds, chargebacks and settlement reconciliation.
- Define recording/publishing rights splits and artist verification, plus KYC and payout controls.
- Replace the demo transactions with a separate production ledger; **do not convert demo totals into real balances**.
- Build purchase entitlements, downloadable licensed audio and subscriber billing only after rights and payments are approved.

### Quick verification

1. Register artist A and upload a song; approve it as admin.
2. Register listener B, select Tip (demo) or Buy R15 (demo), confirm simulation.
3. Sign in as artist A and open Artist Studio to see the simulated totals.
4. Sign in as admin to inspect the demo transactions.
5. Confirm no payment credentials are requested and no withdraw option exists.
