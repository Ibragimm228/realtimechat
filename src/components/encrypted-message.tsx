import Image from "next/image"
import { decryptMessage } from "@/lib/crypto"
import { decryptFile, isPreviewableImageType, isAudioType, formatFileSize, type FileMetadata } from "@/lib/file-crypto"
import { parseMarkdown } from "@/lib/markdown"
import { useEffect, useState, useRef } from "react"

const WHISPER_VIEW_SECONDS = 5

interface ReplyData {
  author: string
  quote: string
}

function parseReply(raw: string): { reply: ReplyData | null; rest: string } {
  if (!raw.startsWith("REPLY:::")) return { reply: null, rest: raw }
  const parts = raw.slice(8).split(":::")
  if (parts.length >= 3) {
    const author = parts[0]
    const quote = parts[1]
    const rest = parts.slice(2).join(":::")
    return { reply: { author, quote }, rest }
  }
  return { reply: null, rest: raw }
}

export const EncryptedMessage = ({
  text,
  encryptionKey,
  onBurn,
  burnAfter,
  messageTimestamp,
  onDecrypted,
}: {
  text: string
  encryptionKey: CryptoKey | null
  onBurn?: () => void
  burnAfter?: number
  messageTimestamp?: number
  onDecrypted?: (plaintext: string) => void
}) => {
  const [isWhisper, setIsWhisper] = useState(false)
  const [whisperRevealed, setWhisperRevealed] = useState(false)
  const [whisperCountdown, setWhisperCountdown] = useState(WHISPER_VIEW_SECONDS)
  const [isBurn, setIsBurn] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [isInk, setIsInk] = useState(false)
  const [isFile, setIsFile] = useState(false)
  const [fileMeta, setFileMeta] = useState<FileMetadata | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [burnTime, setBurnTime] = useState<number | null>(null)
  const [content, setContent] = useState("")
  const [isRevealed, setIsRevealed] = useState(false)
  const [replyData, setReplyData] = useState<ReplyData | null>(null)
  const onBurnRef = useRef(onBurn)
  const onDecryptedRef = useRef(onDecrypted)

  useEffect(() => {
    onBurnRef.current = onBurn
  }, [onBurn])

  useEffect(() => {
    onDecryptedRef.current = onDecrypted
  }, [onDecrypted])

  useEffect(() => {
    if (burnTime === null || burnTime <= 0) {
      if (burnTime === 0) onBurnRef.current?.()
      return
    }

    const timer = setTimeout(() => {
      setBurnTime(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [burnTime])

  useEffect(() => {
    if (!encryptionKey) return
    decryptMessage(text, encryptionKey).then((raw) => {
      const { reply, rest } = parseReply(raw)
      setReplyData(reply)

      if (rest.startsWith("WHISPER:::")) {
        setIsWhisper(true)
        const plaintext = rest.slice(10)
        setContent(plaintext)
        setIsRevealed(true)
        onDecryptedRef.current?.(plaintext)
      } else if (rest.startsWith("BURN:::")) {
        setIsBurn(true)
        const plaintext = rest.slice(7)
        setContent(plaintext)
        setIsRevealed(true)
        onDecryptedRef.current?.(plaintext)
        if (burnAfter && messageTimestamp) {
          const elapsed = Math.floor((Date.now() - messageTimestamp) / 1000)
          setBurnTime(Math.max(0, burnAfter - elapsed))
        } else {
          setBurnTime(15)
        }
      } else if (rest.startsWith("CODE:::")) {
        setIsCode(true)
        const plaintext = rest.slice(7)
        setContent(plaintext)
        setIsRevealed(true)
        onDecryptedRef.current?.(plaintext)
      } else if (rest.startsWith("INK:::")) {
        setIsInk(true)
        const plaintext = rest.slice(6)
        setContent(plaintext)
        setIsRevealed(true)
        onDecryptedRef.current?.(plaintext)
      } else if (rest.startsWith("FILE:::") && encryptionKey) {
        setIsFile(true)
        setIsRevealed(true)
        const fileData = rest.slice(7)
        onDecryptedRef.current?.("[file]")
        decryptFile(fileData, encryptionKey).then(({ blob, meta }) => {
          setFileMeta(meta)
          setFileUrl(URL.createObjectURL(blob))
        }).catch(() => setContent("Failed to decrypt file"))
      } else if (rest.startsWith("VOICE:::") && encryptionKey) {
        setIsFile(true)
        setIsRevealed(true)
        const voiceData = rest.slice(8)
        onDecryptedRef.current?.("[voice message]")
        decryptFile(voiceData, encryptionKey).then(({ blob, meta }) => {
          setFileMeta({ ...meta, name: "Voice message" })
          setFileUrl(URL.createObjectURL(blob))
        }).catch(() => setContent("Failed to decrypt voice"))
      } else {
        setContent(rest)
        setIsRevealed(true)
        onDecryptedRef.current?.(rest)
      }
    })
  }, [text, encryptionKey, burnAfter, messageTimestamp])

  useEffect(() => {
    if (!whisperRevealed || whisperCountdown <= 0) return

    const timer = setTimeout(() => {
      setWhisperCountdown(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [whisperRevealed, whisperCountdown])

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl)
    }
  }, [fileUrl])

  const replyBlock = replyData && (
    <div className="mb-2 pl-2 border-l-2 border-primary/40 opacity-70">
      <span className="text-[10px] font-bold text-primary">{replyData.author}</span>
      <p className="text-[11px] text-muted-foreground truncate">{replyData.quote}</p>
    </div>
  )

  if (whisperRevealed && whisperCountdown <= 0) {
    return (
      <span className="text-[10px] text-muted-foreground/50 italic select-none">
        [Whisper expired — content removed]
      </span>
    )
  }

  if (isWhisper && !whisperRevealed) {
    return (
      <>
        {replyBlock}
        <span
          onClick={() => setWhisperRevealed(true)}
          className="relative cursor-pointer inline-block bg-foreground/10 rounded px-1 -mx-1"
          title="Click to reveal (auto-expires in 5s)"
        >
          <span className="filter blur-md hover:blur-sm transition-all duration-300 select-none block min-w-[50px]">
            {content}
          </span>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black uppercase text-muted-foreground/70 pointer-events-none tracking-widest whitespace-nowrap">
            Whisper · tap to reveal
          </span>
        </span>
      </>
    )
  }

  if (isWhisper && whisperRevealed) {
    return (
      <>
        {replyBlock}
        <span className="relative inline-block">
          <span className="whitespace-pre-wrap">{content}</span>
          <span className="ml-2 text-[9px] font-black text-destructive/70 uppercase animate-pulse">
            {whisperCountdown}s
          </span>
        </span>
      </>
    )
  }

  if (isFile && isRevealed && fileMeta && fileUrl) {
    return (
      <>
        {replyBlock}
        <div className="space-y-1">
          {isPreviewableImageType(fileMeta.type) ? (
            <div className="space-y-2">
              <Image src={fileUrl} alt={fileMeta.name} width={300} height={300} unoptimized className="max-w-[300px] max-h-[300px] rounded-lg object-cover" />
              <a
                href={fileUrl}
                download={fileMeta.name}
                className="inline-flex items-center gap-2 text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
              >
                Download image
              </a>
            </div>
          ) : isAudioType(fileMeta.type) ? (
            <div className="flex items-center gap-3 p-2 bg-black/10 rounded-lg min-w-[200px]">
              <audio src={fileUrl} controls className="w-full h-8 [&::-webkit-media-controls-panel]:bg-transparent" />
            </div>
          ) : (
            <a href={fileUrl} download={fileMeta.name} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{fileMeta.name}</p>
                <p className="text-[10px] opacity-60">{formatFileSize(fileMeta.size)}</p>
              </div>
            </a>
          )}
        </div>
      </>
    )
  }

  if (isFile && isRevealed && !fileUrl) {
    return <span className="text-xs text-muted-foreground animate-pulse">Decrypting file...</span>
  }

  if (isInk && isRevealed) {
    return (
      <>
        {replyBlock}
        <span className="inline-block select-none [&>span]:bg-foreground [&>span]:text-transparent hover:[&>span]:bg-transparent hover:[&>span]:text-current active:[&>span]:bg-transparent active:[&>span]:text-current transition-all cursor-pointer" title="Hold to reveal">
          <span className="rounded px-0.5 transition-all duration-200 whitespace-pre-wrap">{content}</span>
        </span>
      </>
    )
  }

  return (
    <div className="relative">
      {replyBlock}
      {isBurn && burnTime !== null && (
        <div className="absolute -top-6 -right-2 flex items-center gap-1.5 px-2 py-0.5 bg-destructive/10 rounded-full border border-destructive/20 animate-pulse">
          <span className="text-[9px] font-black text-destructive uppercase tracking-tighter">Self-Destruct in</span>
          <span className="text-[10px] font-mono font-bold text-destructive">{burnTime}s</span>
        </div>
      )}
      {isCode && isRevealed ? (
        <pre className="font-mono text-[13px] bg-black/20 p-3 rounded-lg overflow-x-auto border border-white/5 my-1 leading-relaxed">
          <code>{content}</code>
        </pre>
      ) : isRevealed ? (
        <span
          className="whitespace-pre-wrap [&_a]:underline [&_a]:text-primary [&_code]:bg-black/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
        />
      ) : (
        <span className="text-xs text-muted-foreground opacity-50">…</span>
      )}
    </div>
  )
}
