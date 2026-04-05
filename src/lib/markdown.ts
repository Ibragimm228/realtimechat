export function parseMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")

  html = html.replace(/`([^`]+)`/g, '<code class="bg-black/20 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")

  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>")

  html = html.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-primary hover:opacity-80">$1</a>'
  )

  return html
}
