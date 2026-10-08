# Prepared reviewer access

Órbita belongs to Alba Vision. Sankalpa is a client; its live database and
configuration must not be changed for app-review preparation.

The proposed separate Netlify function serves `/orbita/review/`. It is
disabled by default and in every preview, unpublished deployment, other
Netlify site or account, and on another origin. It uses a separate access
code and session key; it does not accept the operator or worker credentials.
Sessions expire after one hour. Cookies are Secure, HttpOnly and SameSite
Strict; write operations require the canonical Origin and a session nonce.

The only allowed Meta assets are app `1782537496230918`, test WABA
`1791155449006041`, test phone `1265673903305629` and the demonstration
template `orbita_revision_demo_20261008`. The reviewer can inspect that test
phone and create/retrieve that fixed template. It cannot choose a different
asset, inspect client conversations, send a message, modify client settings,
access Supabase, import history or connect a real phone. Existing templates
are returned without being changed or duplicated.

## Production activation prerequisites

This source change alone neither publishes the updated privacy page nor
activates reviewer access. Prepare and verify these values privately:

| Production Functions/Runtime variable | Required value |
| --- | --- |
| `ORBITA_REVIEW_ENABLED` | Leave unset or `false` until activation is authorized |
| `ORBITA_REVIEW_ACCESS_HASH` | SHA-256 hex digest of a separately generated, cryptographically random review access code of at least 32 random bytes |
| `ORBITA_REVIEW_SESSION_KEY` | Independent random base64url secret, at least 43 characters; never reuse an operator, worker or master key |
| `ORBITA_REVIEW_META_TOKEN` | Dedicated credential for the test account with actual permission to retrieve/manage its templates |

`ORBITA_META_APP_ID` retains the existing app ID. New reviewer secrets must
not be placed in static assets, client-side JavaScript, source control,
review archives or preview/build environments. The human-facing review
access code must be supplied only through Meta's private reviewer
instructions when its destination and access are authorized; do not give
the reviewer the Meta token, session key, operator or database credentials.

The existing durable messaging system-user token returned HTTP 403 / Meta
code 200 on the template endpoint. It must not be treated as a verified
template-management credential. A separate temporary review token was
renewed and successfully retrieved the previously approved test template.
That temporary token is suitable for the local recording, not for assuming
stable reviewer access. Resolve durable test-account template access before
enabling the proposed production reviewer function. Refreshing the local
recording token does not replace the deployed messaging token.

## Review evidence and remaining requirements

The functional recording creates template `1076740648470416` and then
retrieves its PENDING state. It uses real calls and chronological captures,
not a simulated provider result. The separate phone recording must show
the authorized recipient sending the catalog question and receiving the
actual reply from the Meta test number. The real Alba Vision number remains
unconnected, blocked by advanced-permission error 2655111.

Meta's screencast guide also requires the applicable sign-in and permission
authorization flow. The functional template recording alone is not a claim
that this complete flow has been recorded. Keep incomplete artifacts and
the externally inaccessible access path marked as preparation drafts.

Only the owner's confirmed data-minimization practice was selected in the
Meta draft. Complete all processor locations from verified sources before
declaring the processor list exhaustive. The corrected privacy source
describes the actual Netlify/Supabase operation and the outstanding real
phone onboarding; it no longer describes the old temporary tunnel as the
current receiver.

Validation: 46 tests pass, including default/preview denial, forged/expired
sessions, Origin/CSRF and body limits, fixed-asset isolation, no token
disclosure, template idempotency and prevention of message/order endpoints.
The Next.js production build passes. No database migration is needed.
