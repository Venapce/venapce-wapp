// A deliberately small Markdown → HTML renderer for package READMEs: headings,
// paragraphs, bold / italic / inline code, links, bullet and numbered lists,
// fenced code and blockquotes. Everything is HTML-escaped first, so a README
// from an untrusted catalog cannot inject markup; raw HTML in the source is
// shown as text. Anything fancier (tables, images) falls through as text —
// the full write-up is one click away on the package's homepage.

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const para: string[] = []
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para.length = 0
    }
  }
  while (i < lines.length) {
    const line = lines[i]!
    if (line.startsWith('```')) {
      flush()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i++]!)
      i++
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`)
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      const level = Math.min(h[1]!.length + 1, 6) // README's h1 renders as h2 under the page title
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`)
      i++
      continue
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flush()
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*+]|\d+\.)\s+/, ''))
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }
    if (line.startsWith('>')) {
      flush()
      const q: string[] = []
      while (i < lines.length && lines[i]!.startsWith('>')) q.push(lines[i++]!.replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`)
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush()
      out.push('<hr>')
      i++
      continue
    }
    if (!line.trim()) {
      flush()
      i++
      continue
    }
    para.push(line.trim())
    i++
  }
  flush()
  return out.join('\n')
}
