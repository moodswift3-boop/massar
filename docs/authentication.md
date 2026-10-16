# Authentication: current status and planned flow

## Current status

The initial Massar site is a static HTML prototype. It does **not** implement sign-in, sign-up, password storage, sessions, OAuth, or server-side authorization. Progress is stored in the browser's local storage only. Do not describe this prototype as having production authentication.

## Components needed before real accounts are introduced

1. **Identity provider or server-side authentication service** — responsible for verifying identity and issuing a session.
2. **Sign-in UI** — collects only the inputs required by the selected provider. Never log passwords or one-time codes.
3. **Callback/return endpoint (OAuth only)** — validates the authorization response and exchanges the one-time code on the server.
4. **Session handling** — prefer server-managed sessions or provider-supported secure session cookies; configure HttpOnly, Secure, and an appropriate SameSite policy for cookies.
5. **Authorization checks** — enforce access rules on the server for every protected resource; hiding a button in the browser is not authorization.
6. **Account recovery and abuse protection** — rate limiting, safe reset flows, and non-enumerating error messages.
7. **Configuration and secret management** — keep private keys, client secrets, database credentials, and service-role keys in server-side environment configuration or a secret manager. Never commit them or expose them in client bundles.
8. **Privacy and operations** — define retention, deletion, logging, monitoring, and incident-response procedures before public launch.

## Conditional OAuth request flow

This is a design outline, not a description of code that already exists in this repository.

1. The user chooses “Continue with provider”.
2. The server creates a short-lived authorization request with a cryptographically random state; use PKCE where supported and appropriate.
3. The browser is redirected to the identity provider's authorization page.
4. The provider returns the browser to a registered callback URL with an authorization code and state.
5. The server verifies state and exchanges the code through a back-channel request. A client secret, if required, stays server-side.
6. The server validates the provider response and identifies the account.
7. The application creates its own secure session, then redirects to a safe, allowlisted destination.
8. On logout, the application invalidates its session and clears the session cookie. Provider-token revocation should be implemented where relevant.

## GitHub-specific notes

If GitHub login is selected later, choose an OAuth App or GitHub App based on the product's actual needs. Request the minimum scopes. A GitHub personal access token is not a substitute for end-user sign-in. Never ask users to paste a personal access token into the Massar website. For an integration that acts on repositories, prefer a GitHub App where its permissions and installation model fit.

## Required checks before production

- [ ] Select the identity provider and document why.
- [ ] Register exact production and development callback URLs.
- [ ] Validate state; use PKCE when supported.
- [ ] Keep client secrets and private keys on the server.
- [ ] Configure secure session cookies and CSRF protections appropriate to the architecture.
- [ ] Enforce authorization server-side.
- [ ] Add rate limits, recovery flows, and security logging without secrets.
- [ ] Test login, logout, expiration, revocation, account linking, and failure cases.
- [ ] Publish a privacy notice and account deletion process.
- [ ] Review dependencies and deploy configuration before enabling public sign-up.

## References

- GitHub Docs, Authorizing OAuth apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- GitHub Docs, Building OAuth apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- GitHub Docs, Differences between GitHub Apps and OAuth apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
- GitHub Docs, Managing your personal access tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

These references explain provider-side concepts. They do not imply that OAuth has been implemented in this repository.
