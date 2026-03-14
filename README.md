# >private_chat

End-to-end encrypted, self-destructing chat rooms. No accounts, no logs, no traces.

## Features

- **End-to-End Encryption** — AES-GCM-256 encryption. Keys never leave the client. Stored in URL hash (not sent to server).
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

## Architecture

```
Client (Browser)
├── Generates AES-256 key → stored in URL hash (#)
├── Encrypts all messages before sending
├── Decrypts messages on receive
└── Key never sent to server

Server (Next.js + Elysia)
├── Stores encrypted blobs in Redis
├── Manages room lifecycle (TTL, capacity)
├── Broadcasts via Upstash Realtime
└── Cannot read message content
```

## Deploy

Deploy on [Vercel](https://vercel.com) with one click. Add your Upstash environment variables.

## License

MIT

---

Created by [@FrontendMania](https://t.me/FrontendMania)
