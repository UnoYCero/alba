# Isolated Meta reviewer access

Órbita is Alba Vision's platform; Sankalpa is a client. The client database
and existing WhatsApp configuration must remain unchanged.

Published reviewer URL: https://albavision.tech/orbita/review
Both entry slash forms and subpaths are explicitly routed. Other prefixes,
origins, previews, unpublished deployments and sites/accounts are denied.
The source defaults to disabled unless production configuration is complete.

Access uses a separately generated 32-byte code, SHA-256 hash and independent
session HMAC key. One-hour cookies are Secure, HttpOnly and SameSite Strict.
Writes require canonical Origin, exact body schema and session CSRF nonce.

Allowed assets: app 1782537496230918, test WABA 1791155449006041, test phone
1265673903305629, template orbita_revision_demo_20261008. Only phone inspection
and fixed-template creation/retrieval are available. Existing templates are
returned unchanged. No chats, message sending, orders, database access or
real-number onboarding are exposed.

## Authorized production configuration

- ORBITA_REVIEW_ENABLED=true
- ORBITA_REVIEW_ACCESS_HASH: SHA-256 hex of private random access code
- ORBITA_REVIEW_SESSION_KEY: separate random base64url secret
- ORBITA_REVIEW_META_TOKEN: separate system-user API credential for test assets

Values are marked secrets only in production. The existing Netlify plan
does not allow narrower custom scopes; they are available to production
Builds, Functions and Runtime, never previews. Do not put them in static
assets, browser JavaScript, source control or review archives. Only the
human review code belongs in Meta's authorized private instructions.

The separate credential was verified after the owner authorized test-WABA
template management. Meta's issuance requires management and messaging;
public_profile is automatic. The portal restricts operations independently
of token scopes. The existing messaging token was not replaced.
The review token expires 7 December 2026 (1796667865). Renew it before expiry
to maintain the year of access Meta requests; no automatic renewal is set up.

## Validation and evidence

47 tests pass, including both normalized entries, default/preview denial,
neighboring-prefix denial, forged/expired sessions, Origin/CSRF, body limits,
asset isolation, no credential disclosure and template idempotency.
Next.js production build passes. Production login, phone lookup, APPROVED
template retrieval, existing-template return, unauthenticated denial,
wrong-code denial and unavailable chat/message endpoints were verified.
No database migration is required.

Template ID 1076740648470416 was PENDING in the original creation recording;
Meta later approved it. The public English portal recording shows APPROVED.
The owner's phone recording shows the actual closed-menu response. Neither
recording claims successful real-number coexistence or completed Meta OAuth.

Meta review remains a draft. Outstanding: authentic Meta authorization
recording, complete processor-country list, maintaining reviewer credential
availability, permitted-use attestations and final submission. public_profile
requires the automatic-scope attestation, no invented profile feature.
Real Alba Vision onboarding remains blocked by advanced-access error 2655111.
