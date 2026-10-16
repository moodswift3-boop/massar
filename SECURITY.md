# Security policy

## Current support status

Massar is an early prototype. It is not yet ready for accounts, sensitive personal data, or production use.

## Reporting a vulnerability

Please do not post exploitable details or secrets in a public issue. Contact the repository maintainer through a private channel available from the repository owner profile. Include a description, impact, and safe reproduction steps.

## Secret-handling rules

- Never commit passwords, API keys, OAuth client secrets, private keys, database URLs containing credentials, or access tokens.
- Keep server-side secrets out of browser JavaScript, static HTML, source maps, and public build artifacts.
- If a secret is committed, revoke or rotate it first; deleting it from the latest commit alone does not invalidate it.
- Use least-privilege permissions and short-lived credentials where possible.
- Do not collect sensitive user data until a reviewed authentication, authorization, retention, and deletion design is in place.

## Scope

The current static prototype stores unit-completion flags in browser local storage. It has no account system or backend authorization.
