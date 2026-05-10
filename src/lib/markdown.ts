const MAX_MARKDOWN_INPUT_LENGTH = 20_000
const PLACEHOLDER_PREFIX = "\u0000MD_"
const PLACEHOLDER_SUFFIX = "_MD\u0000"
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`*]+/gi
const TRAILING_URL_PUNCTUATION = /[.,;:!?)\]]+$/

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#x60;")
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (url.username || url.password) return null
    return encodeURI(url.href)
  } catch {
    return null
  }
}

function splitTrailingPunctuation(url: string) {
  const punctuation = url.match(TRAILING_URL_PUNCTUATION)?.[0] ?? ""
  return {
    url: punctuation ? url.slice(0, -punctuation.length) : url,
    punctuation,
  }
}

function renderLink(rawUrl: string) {
  const { url, punctuation } = splitTrailingPunctuation(rawUrl)
  const normalized = normalizeUrl(url)
  if (!normalized) return null

  const href = escapeAttribute(normalized)
  const label = escapeHtml(url)
  return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow ugc" class="underline text-primary hover:opacity-80">${label}</a>${escapeHtml(punctuation)}`
}

export function parseMarkdown(text: unknown): string {
  if (typeof text !== "string" || text.length > MAX_MARKDOWN_INPUT_LENGTH) {
    return ""
  }

  const placeholders: string[] = []
  const reserve = (html: string) => {
    const token = `${PLACEHOLDER_PREFIX}${placeholders.length}${PLACEHOLDER_SUFFIX}`
    placeholders.push(html)
    return token
  }

  let html = text.replace(/\u0000/g, "\uFFFD")

  html = html.replace(/`([^`\n]+)`/g, (_match, code: string) =>
    reserve(`<code class="bg-black/20 px-1 py-0.5 rounded text-[13px] font-mono">${escapeHtml(code)}</code>`)
  )

  html = html.replace(URL_PATTERN, (match) => {
    const link = renderLink(match)
    return link ? reserve(link) : match
  })

  html = escapeHtml(html)
  html = html.replace(/~~([\s\S]+?)~~/g, "<del>$1</del>")
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")

  for (let index = 0; index < placeholders.length; index++) {
    html = html.split(`${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`).join(placeholders[index])
  }

  return html
}
