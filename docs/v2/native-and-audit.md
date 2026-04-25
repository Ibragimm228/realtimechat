# Native And Audit Track

## Native-First Direction

The long-term secure target is not web-only.

`v2` is designed so the protocol and delivery backend can later serve:

- Android
- iOS
- Desktop
- A reduced-capability web client

## What Web Can Do

- Prototype the identity, device, direct chat, and sender-key flows.
- Validate API contracts and transport semantics.
- Surface safety numbers, device lists, and transparency data.
- Run a browser-first Signal-style MVP via a WASM protocol core.

## What Web Cannot Honestly Claim

- Signal-level resistance to malicious server-delivered code
- Hardware-backed secret storage parity with native secure enclaves
- Production-grade sealed sender / metadata minimization guarantees by itself

## Protocol Runtime Split

- `@getmaapp/signal-wasm` is the current browser-compatible MVP runtime inside this repo.
- Official `@signalapp/libsignal-client` remains the better long-term reference point for native/desktop-class integrations, but it is not directly browser-bundle friendly here.
- The `src/lib/v2/` boundary is intentionally shaped so the runtime can be swapped without rewriting the entire app shell.

## Audit Readiness Checklist

- Threat model checked into the repo
- Protocol boundaries documented
- No custom cryptographic primitives
- Reproducible build plan for future native clients
- Build signing plan for released clients
- Device compromise and key rotation playbooks
- External penetration test scope
- Independent cryptographic review scope
- Transparency log monitoring plan

## Deployment Direction

The current repo can host the `v2` web MVP and typed façade APIs, but the long-term protocol backend should be deployable independently so native clients can use the same identity, bundle, inbox, and transparency services.
