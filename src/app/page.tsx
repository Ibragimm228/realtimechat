"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"

import { generateKey } from "@/lib/crypto"
import { client } from "@/lib/client"
import { deriveAccessProof } from "@/lib/access-proof"
import { useUsername } from "@/hooks/use-username"
import { useActiveChats, type ChatType } from "@/hooks/use-active-chats"
import { ThemeSelector } from "@/components/theme-selector"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { useToast } from "@/components/toast"
import { Onboarding } from "@/components/onboarding"

import { I18N, type Lang } from "@/lib/anon-data"
import {
  decodeInviteCode,
  encodeInviteCode,
  formatCodeDisplay,
} from "@/lib/invite-code"
import { generateQRDataURL } from "@/lib/qr"
import Image from "next/image"

function useLang() {
  const [lang, setLang] = useState<Lang>("en")
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null
    const timer = window.setTimeout(() => {
      if (saved === "en" || saved === "ru") setLang(saved)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])
  const setLangPersisted = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem("lang", l) } catch {}
  }
  return { lang, setLang: setLangPersisted }
}

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (name) {
    case "reroll":
      return (<svg {...common}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>)
    case "chats":
      return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>)
    case "close":
      return (<svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>)
    default:
      return null
  }
}

function PillButton({
  active,
  onClick,
  last,
  num,
  sub,
}: {
  active: boolean
  onClick: () => void
  last: boolean
  num: string
  sub: string
}) {
  const [hover, setHover] = useState(false)
  const background = active
    ? "var(--ink)"
    : hover
    ? "var(--bg)"
    : "transparent"
  const color = active ? "var(--bg)" : "var(--ink)"
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        appearance: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "14px 8px",
        background,
        color,
        border: "none",
        borderRight: last ? "none" : "1px solid var(--rule-soft)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        transition: "background .12s, color .12s",
        minWidth: 0,
        width: "100%",
      }}
    >
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: "-0.01em",
        }}
      >
        {num}
      </span>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {sub}
      </span>
    </button>
  )
}

const Page = () => (
  <Suspense>
    <Lobby />
  </Suspense>
)
export default Page

function Lobby() {
  const { username, regenerate } = useUsername()
  const { chats, removeChat } = useActiveChats()
  const router = useRouter()
  const { toast } = useToast()
  const { lang, setLang } = useLang()
  const t = I18N[lang]

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const searchParams = useSearchParams()
  const wasDestroyed = searchParams.get("destroyed") === "true"
  const errorParam = searchParams.get("error") || ""

  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)

  const searching = false
  const searchSecs = 0
  const isCreatingQuick = false

  const cancelSearch = useCallback(() => {}, [])

  const findStranger = useCallback(() => {
    toast(
      lang === "ru"
        ? "Случайный матч отключён: он ослаблял end-to-end шифрование. Используй приватный invite code."
        : "Random matchmaking is disabled because it weakened end-to-end encryption. Use a private invite code instead.",
      "warning",
    )
  }, [lang, toast])

  const glyph = mounted ? (username?.[0] || "?").toUpperCase() : "?"
  const displayUsername = mounted ? username || "…" : "…"

  const onJoinCode = () => {
    const raw = code.trim()
    if (!raw) return
    setCodeError(null)

    const decoded = decodeInviteCode(raw)
    if (decoded) {
      window.location.href = `${window.location.origin}/room/${decoded.roomId}#${decoded.key}`
      return
    }

    const handleMatch = raw.match(/^@?([a-zA-Z0-9_]{1,30})$/)
    if (handleMatch) {
      router.push(`/join/${handleMatch[1]}`)
      return
    }

    setCodeError(t.badCode)
  }

  const errorAlert = useMemo(() => ERROR_ALERTS[errorParam]?.[lang], [errorParam, lang])

  return (
    <div className="frame">
      <Onboarding />
      <KeyboardShortcuts />
      <ActiveChatsButton />

      <div className="rail">
        <div className="brand">
          <div className="brand-mark">ANON</div>
          <div className="brand-word">anon-chat<em>.</em>com</div>
        </div>
        <div className="rail-center" />
        <div className="rail-right">
          <div className="lang-toggle">
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "ru" ? "active" : ""} onClick={() => setLang("ru")}>RU</button>
          </div>
          <ThemeSelector />
        </div>
      </div>

      <div
        className="home"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(500px, 620px) minmax(0, 1fr)",
        }}
      >
        <div className="home-left">
          <div className="kicker">
            <span className="num">01 / 02</span>
            <span>— {t.kicker01}</span>
          </div>

          <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t.heroTitle }} />

          <p className="hero-sub">{t.heroSub}</p>

          <div className="identity">
            <div className="glyph">{glyph}</div>
            <div className="idmeta">
              <div className="idlbl">{t.sessionId}</div>
              <div className="idnum" title={mounted ? username : undefined} suppressHydrationWarning>
                {displayUsername}
              </div>
            </div>
            <button className="reroll" onClick={regenerate} title={t.reroll} aria-label={t.reroll}>
              <Icon name="reroll" size={14} />
            </button>
          </div>

          {(wasDestroyed || errorAlert) && (
            <div className="flex col gap-8">
              {wasDestroyed && (
                <div className="alert danger">
                  <div className="alert-title">
                    {lang === "ru" ? "Комната уничтожена" : "Room destroyed"}
                  </div>
                  <div className="alert-body">
                    {lang === "ru"
                      ? "Все сообщения удалены безвозвратно."
                      : "All messages were permanently deleted."}
                  </div>
                </div>
              )}
              {errorAlert && (
                <div className="alert danger">
                  <div className="alert-title">{errorAlert.title}</div>
                  <div className="alert-body">{errorAlert.body}</div>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto" />
        </div>

        <div className="home-right">
          <div className="kicker">
            <span className="num">02 / 02</span>
            <span>— CONNECT</span>
          </div>

          <div className="flex col gap-12">
            <div className="join-row join-hero">
              <input
                type="text"
                placeholder={t.codePlaceholder}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/[^a-zA-Z0-9_@.\-\s]/g, ""))
                  if (codeError) setCodeError(null)
                }}
                onKeyDown={(e) => e.key === "Enter" && onJoinCode()}
                maxLength={200}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              <button onClick={onJoinCode} disabled={!code.trim()}>
                {t.enter} <span style={{ fontSize: 14 }}>↵</span>
              </button>
            </div>
              {codeError && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  color: "var(--danger)",
                  paddingLeft: 2,
                }}
              >
                {codeError}
              </div>
            )}
          </div>

          <div className="options options-2 options-tall">
            <div
              className="option primary"
              role="button"
              tabIndex={0}
              onClick={() => !isCreatingQuick && !searching && findStranger()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !isCreatingQuick && !searching && findStranger()}
            >
              <div className="onum">01 — {t.enter.toUpperCase()}</div>
              <h3>
                {t.findStranger.split(" ")[0]}{" "}
                <em>{t.findStranger.split(" ").slice(1).join(" ")}</em>
              </h3>
              <p>{t.findStrangerDesc}</p>
              <div className="arrow">{isCreatingQuick || searching ? "…" : "→"}</div>
            </div>
            <div
              className="option"
              role="button"
              tabIndex={0}
              onClick={() => setCreateOpen(true)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setCreateOpen(true)}
            >
              <div className="onum">02 — {t.create.toUpperCase()}</div>
              <h3>
                <em>{t.newRoom.split(" ")[0]}</em>{" "}
                {t.newRoom.split(" ").slice(1).join(" ")}
              </h3>
              <p>{t.newRoomDesc}</p>
              <div className="arrow">→</div>
            </div>
          </div>

          {mounted && chats.length > 0 && (
            <div className="flex col gap-12">
              <div className="kicker">
                <span>{lang === "ru" ? "Недавние чаты" : "Recent chats"}</span>
                <span style={{ marginLeft: "auto", color: "var(--muted-2)" }}>{chats.length}</span>
              </div>
              <div className="flex col gap-6">
                {chats.slice(0, 4).map((chat) => {
                  const prefix: Record<ChatType, string> = { room: "/room/", channel: "/channel/", group: "/group/" }
                  const href = `${prefix[chat.type]}${chat.id}#${chat.encryptionKey}`
                  return (
                    <div
                      key={`${chat.type}-${chat.id}`}
                      className="room-item"
                      onClick={() => { window.location.href = href }}
                    >
                      <div className="rid" title={chat.name}>{chat.name}</div>
                      <div className="rmeta">{chat.type}</div>
                      <div className="rlast">{formatDistanceToNow(chat.joinedAt, { addSuffix: true })}</div>
                      <button
                        className="rclose"
                        onClick={(e) => { e.stopPropagation(); removeChat(chat.type, chat.id) }}
                        title="Remove"
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <SupportSection
            lang={lang}
            onTip={() => setTipOpen(true)}
          />
        </div>
      </div>

      {createOpen && <CreateModal t={t} lang={lang} onClose={() => setCreateOpen(false)} onToast={toast} />}

      {tipOpen && <TipModal lang={lang} onClose={() => setTipOpen(false)} onToast={toast} />}

      {searching && (
        <SearchingModal
          seconds={searchSecs}
          lang={lang}
          onCancel={cancelSearch}
        />
      )}
    </div>
  )
}

function SearchingModal({
  seconds,
  lang,
  onCancel,
}: {
  seconds: number
  lang: Lang
  onCancel: () => void
}) {
  const t = {
    title: lang === "ru" ? "Ищем собеседника…" : "Looking for a partner…",
    body:
      lang === "ru"
        ? "Ты встанешь в очередь. Когда кто-то ещё нажмёт «Найти собеседника» — вас свяжет в одну зашифрованную комнату. Если никто не появится, можно отменить."
        : "You've joined the queue. The next person who clicks Find will be paired with you in a private encrypted room. Cancel any time.",
    secs: lang === "ru" ? "сек в очереди" : "s in queue",
    cancel: lang === "ru" ? "Отменить" : "Cancel",
  }
  return (
    <div className="modal-backdrop" style={{ zIndex: 150 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div className="kicker">
            <span className="num">01 · WAIT</span>
            <span>— MATCHMAKING</span>
          </div>
          <h3 className="modal-hero-title">{t.title}</h3>
        </div>
        <div className="modal-body" style={{ alignItems: "stretch", gap: 18 }}>
          <div className="typing" style={{ justifyContent: "center", gap: 12 }}>
            <div className="dots"><span /><span /><span /></div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink)",
              }}
            >
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
              <span className="text-muted-2" style={{ marginLeft: 6, color: "var(--muted-2)" }}>{t.secs}</span>
            </span>
          </div>
          <p className="modal-hero-sub" style={{ textAlign: "center" }}>{t.body}</p>
          <button className="btn-ghost" style={{ justifyContent: "center" }} onClick={onCancel}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

function SupportSection({
  lang,
  onTip,
}: {
  lang: Lang
  onTip: () => void
}) {
  const title =
    lang === "ru" ? (
      <>
        Сделано одним человеком. <em>Спасибо</em>, если поддержишь.
      </>
    ) : (
      <>
        Built by one person. <em>Thanks</em> if you chip in.
      </>
    )
  const lead =
    lang === "ru"
      ? "Здесь нет рекламы, трекеров и метрик. Проект живёт на энтузиазме — есть два способа сказать «спасибо»:"
      : "No ads, no trackers, no analytics. The project runs on enthusiasm — two ways to say thanks:"

  return (
    <section className="support-section mt-auto">
      <div className="support-head">
        <div className="kicker">
          <span className="num">★</span>
          <span>— {lang === "ru" ? "ПОДДЕРЖКА" : "SUPPORT"}</span>
        </div>
        <h2 className="support-title">{title}</h2>
        <p className="support-lead">{lead}</p>
      </div>

      <div className="support-tiles">
        <a
          href="https://t.me/FrontendMania"
          target="_blank"
          rel="noopener noreferrer"
          className="support-tile primary"
        >
          <div className="support-tile-num">01 — {lang === "ru" ? "ПОДПИСАТЬСЯ" : "FOLLOW"}</div>
          <h3>
            Telegram <em>channel</em>
          </h3>
          <p>
            {lang === "ru"
              ? "Ещё такие проекты, разборы дизайна и заметки каждую неделю."
              : "More projects like this, design breakdowns and weekly notes."}
          </p>
          <div className="support-tile-cta">
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.29-.48.79-.74 3.08-1.34 5.15-2.23 6.21-2.66 2.95-1.23 3.56-1.43 3.97-1.43.09 0 .28.02.4.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
            <span>@FrontendMania</span>
            <span className="arrow">→</span>
          </div>
        </a>

        <button type="button" onClick={onTip} className="support-tile">
          <div className="support-tile-num">02 — {lang === "ru" ? "ЧАЕВЫЕ" : "TIP"}</div>
          <h3>
            <em>Crypto</em> tip
          </h3>
          <p>
            {lang === "ru"
              ? "USDT · TON · BTC · ETH через @CryptoBot. Прямо, анонимно, в пару кликов."
              : "USDT · TON · BTC · ETH via @CryptoBot. Direct, anonymous, a couple of clicks."}
          </p>
          <div className="support-tile-cta">
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v10M9 10h5.5a2 2 0 0 1 0 4H9M9 14h5.5a2 2 0 0 1 0 4H9" />
            </svg>
            <span>{lang === "ru" ? "Отправить чаевые" : "Send tip"}</span>
            <span className="arrow">→</span>
          </div>
        </button>
      </div>
    </section>
  )
}

type TipAsset = "USDT" | "TON" | "BTC" | "ETH"

function TipModal({
  lang,
  onClose,
  onToast,
}: {
  lang: Lang
  onClose: () => void
  onToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void
}) {
  const [asset, setAsset] = useState<TipAsset>("USDT")
  const [amount, setAmount] = useState<number>(5)
  const [isCustom, setIsCustom] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const [loading, setLoading] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, loading])

  const presets: Record<TipAsset, { v: number; sub: string }[]> =
    lang === "ru"
      ? {
          USDT: [{ v: 1, sub: "кофе" }, { v: 5, sub: "обед" }, { v: 20, sub: "ужин" }, { v: 50, sub: "вечеринка" }],
          TON:  [{ v: 1, sub: "кофе" }, { v: 3, sub: "обед" }, { v: 10, sub: "ужин" }, { v: 25, sub: "вечеринка" }],
          BTC:  [{ v: 0.0001, sub: "крошка" }, { v: 0.001, sub: "немного" }, { v: 0.005, sub: "круто" }, { v: 0.01, sub: "ого" }],
          ETH:  [{ v: 0.001, sub: "крошка" }, { v: 0.01, sub: "немного" }, { v: 0.05, sub: "круто" }, { v: 0.1, sub: "ого" }],
        }
      : {
          USDT: [{ v: 1, sub: "coffee" }, { v: 5, sub: "lunch" }, { v: 20, sub: "dinner" }, { v: 50, sub: "party" }],
          TON:  [{ v: 1, sub: "coffee" }, { v: 3, sub: "lunch" }, { v: 10, sub: "dinner" }, { v: 25, sub: "party" }],
          BTC:  [{ v: 0.0001, sub: "tiny" }, { v: 0.001, sub: "nice" }, { v: 0.005, sub: "cool" }, { v: 0.01, sub: "wow" }],
          ETH:  [{ v: 0.001, sub: "tiny" }, { v: 0.01, sub: "nice" }, { v: 0.05, sub: "cool" }, { v: 0.1, sub: "wow" }],
        }

  const currentPresets = presets[asset]

  useEffect(() => {
    setAmount(currentPresets[1].v)
    setIsCustom(false)
    setCustomInput("")
  }, [asset])

  useEffect(() => {
    if (isCustom) requestAnimationFrame(() => customInputRef.current?.focus())
  }, [isCustom])

  const parsedCustom = Number.parseFloat(customInput.replace(",", "."))
  const effectiveAmount =
    isCustom
      ? Number.isFinite(parsedCustom) && parsedCustom > 0
        ? parsedCustom
        : 0
      : amount
  const customValid = isCustom
    ? Number.isFinite(parsedCustom) && parsedCustom >= 0.1 && parsedCustom <= 1000
    : true

  const send = async () => {
    if (!customValid || effectiveAmount <= 0) {
      onToast(
        lang === "ru"
          ? "Введите сумму от 0.1 до 1000"
          : "Enter an amount between 0.1 and 1000",
        "error",
      )
      return
    }
    setLoading(true)
    try {
      const res = await client.support.tip.post({ amount: effectiveAmount, asset })
      const data = res.data as { payUrl?: string; error?: string } | undefined
      if (res.status === 200 && data?.payUrl) {
        window.open(data.payUrl, "_blank", "noopener,noreferrer")
        onToast(lang === "ru" ? "Откройте CryptoBot чтобы оплатить" : "Open CryptoBot to pay", "info")
        onClose()
      } else {
        const err = data?.error || (lang === "ru" ? "Не удалось создать счёт" : "Failed to create invoice")
        onToast(err, "error")
      }
    } catch {
      onToast(lang === "ru" ? "Ошибка сети" : "Network error", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div className="kicker">
            <span className="num">★</span>
            <span>— {lang === "ru" ? "ЧАЕВЫЕ" : "TIP"}</span>
            <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ marginLeft: "auto" }}>
              <Icon name="close" size={14} />
            </button>
          </div>
          <h3 className="modal-hero-title">
            {lang === "ru" ? (
              <>
                <em>Спасибо</em>, что заглянул.
              </>
            ) : (
              <>
                <em>Thanks</em> for dropping by.
              </>
            )}
          </h3>
          <p className="modal-hero-sub">
            {lang === "ru"
              ? "Счёт откроется в CryptoBot. Оплата происходит напрямую из Telegram — без регистрации и карт."
              : "An invoice will open in CryptoBot. Payment happens right inside Telegram — no signup, no cards."}
          </p>
        </div>

        <div className="modal-body" style={{ gap: 22, padding: "6px 24px 22px" }}>
          <div>
            <div className="pill-label">
              <span className="num">A</span>
              <span>— {lang === "ru" ? "ВАЛЮТА" : "ASSET"}</span>
            </div>
            <div
              className="pill-group cols-4"
              role="radiogroup"
              aria-label="Asset"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {(["USDT", "TON", "BTC", "ETH"] as TipAsset[]).map((a, i) => (
                <PillButton
                  key={a}
                  active={asset === a}
                  onClick={() => setAsset(a)}
                  last={i === 3}
                  num={a}
                  sub={a === "USDT" ? "stable" : a === "TON" ? "toncoin" : a}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="pill-label">
              <span className="num">B</span>
              <span>— {lang === "ru" ? "СУММА" : "AMOUNT"}</span>
            </div>
            <div
              className="pill-group cols-5"
              role="radiogroup"
              aria-label="Amount"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {currentPresets.map((p) => (
                <PillButton
                  key={p.v}
                  active={!isCustom && amount === p.v}
                  onClick={() => {
                    setIsCustom(false)
                    setAmount(p.v)
                  }}
                  last={false}
                  num={String(p.v)}
                  sub={p.sub}
                />
              ))}
              <PillButton
                active={isCustom}
                onClick={() => setIsCustom(true)}
                last={true}
                num={"…"}
                sub={lang === "ru" ? "своё" : "custom"}
              />
            </div>

            {isCustom && (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "var(--bg)",
                }}
              >
                <input
                  ref={customInputRef}
                  type="text"
                  inputMode="decimal"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter" && customValid && !loading) send() }}
                  placeholder={lang === "ru" ? "своё число" : "enter amount"}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 18,
                    letterSpacing: "0.06em",
                    padding: "14px 16px",
                    minWidth: 0,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 18px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    borderLeft: "1px solid var(--rule-soft)",
                  }}
                >
                  {asset}
                </div>
              </div>
            )}
            {isCustom && customInput && !customValid && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  color: "var(--danger)",
                }}
              >
                {lang === "ru"
                  ? "— От 0.1 до 1000 —"
                  : "— Between 0.1 and 1000 —"}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "12px 14px",
              border: "1px solid var(--rule-soft)",
              borderRadius: "var(--radius)",
              background: "var(--bg)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {lang === "ru" ? "Итого" : "Total"}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              {effectiveAmount > 0 ? effectiveAmount : "—"}{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}>{asset}</span>
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={send}
            disabled={loading || !customValid || effectiveAmount <= 0}
            style={{ padding: "18px 20px", fontSize: 13 }}
          >
            {loading
              ? lang === "ru"
                ? "Создаём счёт…"
                : "Creating invoice…"
              : lang === "ru"
              ? `Отправить ${effectiveAmount > 0 ? effectiveAmount : ""} ${asset} ↵`
              : `Send ${effectiveAmount > 0 ? effectiveAmount : ""} ${asset} ↵`}
          </button>

          <div className="wip-footer">
            {lang === "ru"
              ? "— Счёт через @CryptoBot · без комиссии площадки —"
              : "— Invoice via @CryptoBot · no platform fee —"}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActiveChatsButton() {
  const { chats } = useActiveChats()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { removeChat } = useActiveChats()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  if (!mounted || chats.length === 0) return null

  return (
    <>
      <button
        className="icon-btn"
        onClick={() => setOpen(true)}
        title="Your chats"
        style={{ position: "fixed", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 50, width: 36, height: 36 }}
      >
        <Icon name="chats" size={16} />
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 600,
            display: "grid",
            placeItems: "center",
          }}
        >
          {chats.length}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--ink) 30%, transparent)",
            zIndex: 60,
            animation: "fadeIn .2s ease",
          }}
        />
      )}

      <aside
        ref={panelRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100%",
          width: 300,
          background: "var(--bg)",
          borderRight: "1px solid var(--rule)",
          zIndex: 70,
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform .3s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="brand-mark">CHATS</div>
            <span className="mono text-muted" style={{ fontSize: 11 }}>{chats.length}</span>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {chats.map((chat) => {
            const prefix: Record<ChatType, string> = { room: "/room/", channel: "/channel/", group: "/group/" }
            const href = `${prefix[chat.type]}${chat.id}#${chat.encryptionKey}`
            return (
              <div
                key={`${chat.type}-${chat.id}`}
                className="room-item"
                onClick={() => { window.location.href = href }}
              >
                <div className="rid" title={chat.name}>{chat.name}</div>
                <div className="rmeta">{chat.type}</div>
                <div className="rlast">{formatDistanceToNow(chat.joinedAt, { addSuffix: true })}</div>
                <button
                  className="rclose"
                  onClick={(e) => { e.stopPropagation(); removeChat(chat.type, chat.id) }}
                  title="Remove"
                >
                  remove ✕
                </button>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}

type InviteInfo = { roomId: string; key: string; code: string }

function CreateModal({
  t,
  lang,
  onClose,
  onToast,
}: {
  t: Record<string, string>
  lang: Lang
  onClose: () => void
  onToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void
}) {
  const [stage, setStage] = useState<"form" | "invite">("form")
  const [invite, setInvite] = useState<InviteInfo | null>(null)

  const [capacity, setCapacity] = useState(2)
  const [duration, setDuration] = useState(600)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "form") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, stage])

  const { mutate: createRoom, isPending: isCreatingRoom } = useMutation({
    mutationFn: async () => {
      const key = await generateKey()
      const accessProof = await deriveAccessProof(key)
      const res = await client.room.create.post({ capacity, ttl: duration, accessProof })
      if (res.status === 200 && res.data?.roomId) {
        const roomId = res.data.roomId
        const code = encodeInviteCode(roomId, key) ?? ""
        setInvite({ roomId, key, code })
        setStage("invite")
      } else {
        throw new Error("Failed to create room")
      }
    },
    onError: () => onToast("Failed to create room. Please try again.", "error"),
  })

  const capacityOptions = [
    { v: 2, sub: lang === "ru" ? "1 на 1" : "1-on-1" },
    { v: 5, sub: lang === "ru" ? "компания" : "small" },
    { v: 10, sub: lang === "ru" ? "команда" : "team" },
    { v: 50, sub: lang === "ru" ? "максимум" : "max" },
  ]
  const durationOptions = lang === "ru"
    ? [
        { v: 600, num: "10", sub: "минут" },
        { v: 3600, num: "1", sub: "час" },
        { v: 86400, num: "24", sub: "часа" },
      ]
    : [
        { v: 600, num: "10", sub: "minutes" },
        { v: 3600, num: "1", sub: "hour" },
        { v: 86400, num: "24", sub: "hours" },
      ]

  if (stage === "invite" && invite) {
    return (
      <InviteStage
        t={t}
        lang={lang}
        invite={invite}
        onToast={onToast}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 560 }}>
        <div
          className="modal-head"
          style={{ flexDirection: "column", alignItems: "stretch", gap: 10, padding: "20px 24px 14px" }}
        >
          <div
            className="kicker"
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <span className="num">01 / 02</span>
              <span>— {t.createTitle.toUpperCase()}</span>
            </span>
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <h3
            className="modal-hero-title"
            dangerouslySetInnerHTML={{ __html: t.newRoomHero }}
          />
          <p className="modal-hero-sub">{t.newRoomSubtitle}</p>
        </div>

        <div className="modal-body" style={{ gap: 22, padding: "6px 24px 22px" }}>
          <div className="seg" role="tablist">
            <button type="button" className="active">
              {t.tabRoom}
            </button>
            <button
              type="button"
              className="seg-wip"
              disabled
              aria-disabled="true"
              title={t.comingSoonFooter}
              style={{ cursor: "not-allowed" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <span>{t.tabChannel}</span>
                <span className="wip-badge">{t.soon}</span>
              </span>
            </button>
            <button
              type="button"
              className="seg-wip"
              disabled
              aria-disabled="true"
              title={t.comingSoonFooter}
              style={{ cursor: "not-allowed" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <span>{t.tabGroup}</span>
                <span className="wip-badge">{t.soon}</span>
              </span>
            </button>
          </div>

          <div>
            <div className="pill-label">
              <span className="num">A</span>
              <span>— {t.maxUsers}</span>
            </div>
            <div
              className="pill-group cols-4"
              role="radiogroup"
              aria-label={t.maxUsers}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {capacityOptions.map((o, i) => (
                <PillButton
                  key={o.v}
                  active={capacity === o.v}
                  onClick={() => setCapacity(o.v)}
                  last={i === capacityOptions.length - 1}
                  num={String(o.v)}
                  sub={o.sub}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="pill-label">
              <span className="num">B</span>
              <span>— {t.selfDestruct}</span>
            </div>
            <div
              className="pill-group cols-3"
              role="radiogroup"
              aria-label={t.selfDestruct}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {durationOptions.map((o, i) => (
                <PillButton
                  key={o.v}
                  active={duration === o.v}
                  onClick={() => setDuration(o.v)}
                  last={i === durationOptions.length - 1}
                  num={o.num}
                  sub={o.sub}
                />
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => createRoom()}
            disabled={isCreatingRoom}
            style={{ padding: "18px 20px", fontSize: 13 }}
          >
            {isCreatingRoom ? t.saving : `${t.forgeRoom} ↵`}
          </button>

          <div className="wip-footer">{t.comingSoonFooter}</div>
        </div>
      </div>
    </div>
  )
}

function InviteStage({
  t,
  lang,
  invite,
  onToast,
  onClose,
}: {
  t: Record<string, string>
  lang: Lang
  invite: InviteInfo
  onToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void
  onClose: () => void
}) {
  const { roomId, key, code } = invite
  const fullLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomId}#${key}`
      : ""
  const displayCode = useMemo(() => formatCodeDisplay(code, 5), [code])
  const qrDataUrl = useMemo(() => {
    try {
      return generateQRDataURL(fullLink, 240)
    } catch {
      return ""
    }
  }, [fullLink])

  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value)
      if (which === "code") {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 1600)
      } else {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 1600)
      }
      onToast(
        which === "code" ? t.copyCode : t.copyLink,
        "success",
      )
    } catch {
      onToast("Copy failed", "error")
    }
  }

  const enterRoom = () => {
    window.location.href = fullLink
  }

  void lang

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div className="kicker" style={{ width: "100%" }}>
            <span className="num">02 / 02</span>
            <span>— SHARE</span>
            <button
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
              style={{ marginLeft: "auto" }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <h3
            className="modal-hero-title"
            dangerouslySetInnerHTML={{ __html: t.yourPrivateCode }}
          />
          <p className="modal-hero-sub">{t.invitePreamble}</p>
        </div>

        <div className="modal-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: qrDataUrl ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div className="flex col gap-8" style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {t.inviteCode}
              </div>
              <div
                className="code-display"
                tabIndex={0}
                onClick={(e) => {
                  const range = document.createRange()
                  range.selectNodeContents(e.currentTarget)
                  const sel = window.getSelection()
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }}
                title={t.copyCode}
              >
                {displayCode}
              </div>
            </div>

            {qrDataUrl && (
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                }}
              >
                <Image
                  src={qrDataUrl}
                  alt="QR"
                  width={168}
                  height={168}
                  unoptimized
                  draggable={false}
                  style={{ width: 168, height: 168, display: "block" }}
                />
              </div>
            )}
          </div>

          <div className="copy-row">
            <button
              className="btn-primary"
              style={{ padding: "14px 16px" }}
              onClick={() => copy(code, "code")}
            >
              {copiedCode ? `${t.copied} ✓` : t.copyCode}
            </button>
            <button
              className="btn-ghost"
              style={{ padding: "14px 16px", justifyContent: "center" }}
              onClick={() => copy(fullLink, "link")}
            >
              {copiedLink ? `${t.copied} ✓` : t.copyLink}
            </button>
          </div>

          <div className="invite-warning">
            <span className="w-label">! {t.inviteWarnLabel}</span>
            <div className="w-body">{t.inviteWarnBody}</div>
          </div>

          <button
            className="btn-primary"
            style={{ padding: "18px 20px", fontSize: 13 }}
            onClick={enterRoom}
          >
            {t.enterRoom} →
          </button>
        </div>
      </div>
    </div>
  )
}

const ERROR_ALERTS: Record<string, Record<Lang, { title: string; body: string }>> = {
  "room-not-found": {
    en: { title: "Room not found", body: "This room may have expired or never existed." },
    ru: { title: "Комната не найдена", body: "Эта комната истекла или никогда не существовала." },
  },
  "room-full": {
    en: { title: "Room full", body: "This room is at maximum capacity." },
    ru: { title: "Комната заполнена", body: "В комнате уже максимум участников." },
  },
  "invalid-room": {
    en: { title: "Invalid room", body: "The room ID format is invalid." },
    ru: { title: "Неверная комната", body: "Некорректный формат ID комнаты." },
  },
  "missing-key": {
    en: { title: "Encryption key missing", body: "This link is incomplete. Request a new invite link from the room creator." },
    ru: { title: "Отсутствует ключ шифрования", body: "Ссылка неполная. Запроси новую ссылку у создателя комнаты." },
  },
  "invalid-key": {
    en: { title: "Invalid encryption key", body: "The encryption key in the URL is corrupted or invalid." },
    ru: { title: "Неверный ключ шифрования", body: "Ключ шифрования в URL повреждён или некорректен." },
  },
  "invite-required": {
    en: { title: "Invite required", body: "You need a valid invite code or secure share link to enter this chat." },
    ru: { title: "Нужно приглашение", body: "Для входа в этот чат нужен корректный invite code или приватная ссылка." },
  },
}
