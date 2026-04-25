# >private_chat

Invite-based encrypted, self-destructing chat rooms. No accounts, minimal persistence, and honest privacy trade-offs.

## Features

- **Invite-Based Encryption** — AES-GCM-256 encryption. Shared keys stay in the client and access is gated by a proof derived from that key.
- **Self-Destructing Rooms** — Set a timer. When it expires, everything is permanently deleted.
- **Panic Mode** — Press `Alt+P` to instantly blur the screen. PIN-protected unlock. 2 wrong attempts = room destroyed.
- **Whisper Messages** — `/w` sends click-to-reveal messages that auto-expire in 5 seconds.
- **Burn Messages** — `/b` sends messages that self-destruct in 15 seconds.
- **Code Snippets** — `/code` sends monospace code blocks.
- **QR Code Sharing** — Generate QR codes for instant room sharing from any device.
- **3 Chat Types** — Private rooms, broadcast channels (admin-only posting), and group chats.
- **@Handle System** — Create memorable handles for channels and groups. Join via `@handle`.
- **Message Reactions** — React to messages with emoji.
- **Reply to Messages** — Quote and respond to specific messages.
- **Markdown Formatting** — `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``.
- **Sound Notifications** — Audio alerts for new messages (Web Audio API, no files).
- **70+ Themes** — Extensive theme system with light/dark variants.
- **Real-time** — Instant message delivery via Upstash Realtime.
- **PWA Ready** — Install as a native app on mobile/desktop.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, React Compiler)
- **API**: Elysia (type-safe REST API with Eden treaty client)
- **Realtime**: Upstash Realtime (WebSocket)
- **Database**: Upstash Redis (serverless)
- **Encryption**: Web Crypto API (AES-GCM-256)
- **Styling**: Tailwind CSS v4
- **State**: TanStack React Query + useSyncExternalStore

## Getting Started

### Prerequisites

- Node.js 18+
- [Upstash](https://upstash.com/) account (free tier works)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd realtime_chat
npm install

# Configure environment
cp env.example .env
# Edit .env with your Upstash Redis credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

Get these from [upstash.com](https://upstash.com/) — create a Redis database.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+P` / `Esc` | Toggle Panic Mode |
| `Alt+S` | Toggle Chat Sidebar |
| `Ctrl+/` | Show all shortcuts |
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Message Commands

| Command | Description |
|---------|-------------|
| `/w <text>` | Whisper — click to reveal, auto-expires in 5s |
| `/b <text>` | Burn — self-destructs in 15 seconds |
| `/code <text>` | Code — monospace block |

## Privacy Notes

- Message content is encrypted client-side for invite-based chats.
- The server still sees metadata such as room/channel/group IDs, membership, timestamps, handles, and traffic volume.
- This project is **not** comparable to Signal's protocol guarantees (no Double Ratchet, no forward secrecy, web-app trust model).
- Active chats now stay in memory for the current tab instead of being persisted in `sessionStorage`.
- Random matchmaking was removed because it required relaying key material through the server.

## V2 Prototype

- A parallel protocol-based prototype now lives at `/v2`.
- `v2` introduces persistent user/device identities, direct-session bootstrap, safety numbers, sender-key groups, device linking/revocation, and a dedicated `api/v2` surface.
- This is still a **web MVP**, not a finished Signal-class client.

## Architecture

```
Client (Browser)
├── Generates AES-256 key → stored in URL hash (#)
├── Derives an access proof from the key
├── Encrypts all messages before sending
└── Decrypts messages on receive

Server (Next.js + Elysia)
├── Stores encrypted blobs and metadata in Redis
├── Verifies key-derived access proofs before admitting members
├── Manages room lifecycle (TTL, capacity)
└── Broadcasts authorized realtime updates via Upstash Realtime
```

## Deploy

Deploy on [Vercel](https://vercel.com) with one click. Add your Upstash environment variables.

## License

MIT

---

Created by [@FrontendMania](https://t.me/FrontendMania)
