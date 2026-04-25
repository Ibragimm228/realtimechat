# V2 Threat Model

## Assets

- User identity keys
- Device private keys
- Signed prekeys and one-time prekeys
- Double Ratchet session state
- Sender key state for groups
- Conversation membership state
- Device link and revoke authority
- Safety number verification state
- Local encrypted history and backup material

## Security Goals

1. The server must not learn direct message plaintexts or group plaintexts.
2. Compromise of one message key must not reveal the entire conversation history.
3. Compromise of one device must not silently become compromise of every current and future device.
4. Users must be able to verify who they are talking to through fingerprints / safety numbers.
5. Device additions and revocations must be visible and auditable.
6. The server should learn only the delivery metadata required to route messages.

## Attacker Model

- Passive network observer
- Active relay/server operator
- Malicious client impersonating another client
- Stolen browser storage on one device
- Malicious group member trying to retain access after removal
- Metadata harvester observing conversation graphs and activity

## Trust Boundaries

## Client

- Trusted to generate and keep private key material local.
- Responsible for session creation, direct encryption, decryption, sender key handling, and fingerprint display.
- Must treat browser storage as weaker than native secure enclaves.

## V2 API / Delivery Service

- Trusted for availability and message routing only.
- Not trusted with plaintext.
- Trusted to expose correct device lists unless detected by key transparency and safety number checks.

## Key Transparency Log

- Used to detect unexpected key or device changes.
- Must be append-only from the client's point of view.
- Can be simpler in MVP, but the data model should already support later hardening.

## Explicit MVP Limitations

- Web storage remains weaker than native secure hardware.
- Metadata minimization is improved but not Signal-complete.
- The MVP uses a repo-local API façade; a dedicated protocol service remains the long-term target.
- Audit readiness does not equal completed external audit.

## Recovery Model

- Device loss requires revocation from another trusted device.
- New devices are linked through short-lived link tokens and explicit device registration.
- History transfer is opt-in, encrypted, and bounded rather than automatic full replication.
