# V2 Secure Messaging

`v2` is a parallel protocol-based messenger track.

The current invite-key chat remains a legacy mode for ephemeral shared-secret rooms.
It is intentionally not extended toward Signal-like guarantees.

## Goals

- Stable `userId` plus multiple `deviceId` values per user.
- X3DH-style session bootstrap for direct chats.
- Double Ratchet for direct message sessions.
- Sender Keys for groups, with an upgrade path toward MLS-like semantics later.
- Safety numbers / fingerprints for identity verification.
- Device linking, device revocation, and bounded encrypted history transfer.
- Lower server knowledge than the legacy room/channel/group model.

## Non-Goals

- No shared secrets in URL hashes.
- No reuse of legacy room membership as protocol identity.
- No expansion of the legacy invite-key cryptography into a pseudo-Signal system.
- No hand-rolled cryptographic primitives.

## Repo Boundaries

- `src/app/api/[[...slugs]]/route.ts` remains the legacy API surface.
- `src/app/api/v2/` is the new typed API façade for the protocol-backed MVP.
- `src/app/v2/` is the new web client entrypoint.
- `src/lib/v2/` contains protocol, storage, API, and domain logic for the new client/server slice.

## Current Protocol Core Choice

- The long-term protocol direction still targets official `libsignal` semantics.
- For the **web MVP inside this repo**, the browser-compatible runtime is `@getmaapp/signal-wasm`.
- The official `@signalapp/libsignal-client` package is not browser-compatible in this Next.js/Turbopack environment, so the app keeps a clean boundary around protocol code to allow a future native or service-backed swap.

## Migration Rule

Any new security-sensitive product work goes into `v2` first.
The legacy app should only receive fixes, maintenance, and deprecation messaging.
