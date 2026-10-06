import { lookup } from "node:dns/promises"
import type { WebConfig } from "./config"

const REDIRECT_LIMIT = 5
const MAX_TEXT_CHARS = 40_000
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "0.0.0.0"])
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".home.arpa"]

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast / reserved
  return false
}

export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === "::1" || v === "::") return true
  if (v.startsWith("fc") || v.startsWith("fd")) return true // unique local
  if (/^fe[89ab]/.test(v)) return true // link-local fe80::/10
  if (v.startsWith("::ffff:")) return isPrivateIPv4(v.slice(7)) // v4-mapped
  return false
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")
}

export function assertFetchable(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`blocked scheme: ${url.protocol}`)
  if (url.username || url.password) throw new Error("blocked: credentials in URL")
  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error(`blocked host: ${host}`)
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new Error(`blocked host: ${host}`)
  if (isIpLiteral(host)) {
    const isPrivate = host.includes(":") ? isPrivateIPv6(host) : isPrivateIPv4(host)
    if (isPrivate) throw new Error(`blocked address: ${host}`)
  }
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIpLiteral(hostname)) return
  const records = await lookup(hostname, { all: true })
  if (records.length === 0) throw new Error(`cannot resolve ${hostname}`)
  for (const record of records) {
    const priv = record.family === 6 ? isPrivateIPv6(record.address) : isPrivateIPv4(record.address)
    if (priv) throw new Error(`blocked: ${hostname} resolves to a private address (${record.address})`)
  }
}

export interface FetchResult {
  status: number
  contentType: string
  text: string
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()
  const decoder = new TextDecoder()
  let out = ""
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      out += decoder.decode(value, { stream: true })
      if (total >= maxBytes) break
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore
    }
  }
  return out
}

export async function safeFetch(
  url: string,
  options: {
    method?: "GET" | "POST"
    body?: string
    contentType?: string
    maxBytes: number
    timeoutMs: number
    signal?: AbortSignal
  },
): Promise<FetchResult> {
  let current = url
  for (let hop = 0; hop <= REDIRECT_LIMIT; hop++) {
    const parsed = new URL(current)
    assertFetchable(parsed)
    await assertPublicHost(parsed.hostname)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    const signal =
      options.signal && "any" in AbortSignal
        ? AbortSignal.any([options.signal, controller.signal])
        : (options.signal ?? controller.signal)
    try {
      const res = await fetch(current, {
        method: options.method ?? "GET",
        body: options.body,
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
          ...(options.contentType ? { "Content-Type": options.contentType } : {}),
          ...(options.method === "POST"
            ? {}
            : { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.7" }),
        },
      })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location")
        if (!location) throw new Error(`redirect without a location (HTTP ${res.status})`)
        current = new URL(location, current).toString()
        continue
      }
      const text = await readCapped(res, options.maxBytes)
      return { status: res.status, contentType: res.headers.get("content-type") ?? "", text }
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error("too many redirects")
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity] ?? match
  })
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

export function htmlToText(html: string): string {
  const blockified = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
  const text = decodeEntities(blockified.replace(/<[^>]*>/g, ""))
  return text
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// Exact URLs seen in this session's search results; web_fetch is limited to these.
const allowedUrls = new Set<string>()

export function recordUrls(urls: string[]): void {
  for (const url of urls) allowedUrls.add(url)
}

export function isAllowedUrl(url: string): boolean {
  return allowedUrls.has(url)
}

export function clearWebAllowlist(): void {
  allowedUrls.clear()
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

type SearchParser = (html: string, max: number) => SearchResult[]

function unwrapDdg(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com")
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname.startsWith("/l/")) {
      const target = url.searchParams.get("uddg")
      if (target) return decodeURIComponent(target)
    }
    return url.toString()
  } catch {
    return href
  }
}

// Bing wraps organic results in https://www.bing.com/ck/a?…&u=a1<base64url>.
function unwrapBing(href: string): string {
  const decoded = decodeEntities(href)
  try {
    const url = new URL(decoded, "https://www.bing.com")
    if (url.hostname.endsWith("bing.com") && url.pathname.startsWith("/ck/a")) {
      let u = url.searchParams.get("u")
      if (u) {
        if (u.startsWith("a1")) u = u.slice(2)
        const padded = u + "=".repeat((4 - (u.length % 4)) % 4)
        try {
          const real = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
          if (/^https?:\/\//i.test(real)) return real
        } catch {
          // fall through
        }
      }
    }
    return url.toString()
  } catch {
    return decoded
  }
}

const parseDdg: SearchParser = (html, max) => {
  const links = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  const snippets = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)]
  const results: SearchResult[] = []
  for (let i = 0; i < links.length && results.length < max; i++) {
    const url = unwrapDdg(links[i][1])
    if (!/^https?:\/\//i.test(url)) continue
    results.push({ title: stripTags(links[i][2]) || url, url, snippet: snippets[i] ? stripTags(snippets[i][1]) : "" })
  }
  return results
}

const parseBing: SearchParser = (html, max) => {
  const blocks = [...html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/gi)]
  const results: SearchResult[] = []
  for (const block of blocks) {
    const heading = block[0].match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!heading) continue
    const url = unwrapBing(heading[1])
    if (!/^https?:\/\//i.test(url)) continue
    const snippet = block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    results.push({ title: stripTags(heading[2]) || url, url, snippet: snippet ? stripTags(snippet[1]) : "" })
    if (results.length >= max) break
  }
  return results
}

interface SearchBackend {
  url: string
  // "{query}" -> GET with substitution; otherwise POST form with q=query.
  parse: SearchParser
}

const parseBrave: SearchParser = (html, max) => {
  const segments = html.split('data-type="web"').slice(1)
  const results: SearchResult[] = []
  for (const segment of segments) {
    const link = segment.match(
      /<a href="(https?:\/\/[^"]+)"[^>]*>[\s\S]{0,4000}?class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    )
    if (!link) continue
    const url = decodeEntities(link[1])
    if (/brave\.com/i.test(url)) continue
    const desc = segment.match(/class="generic-snippet[^"]*"[\s\S]*?class="content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    results.push({ title: stripTags(link[2]) || url, url, snippet: desc ? stripTags(desc[1]) : "" })
    if (results.length >= max) break
  }
  return results
}

function parserFor(url: string): SearchParser {
  if (url.includes("brave.")) return parseBrave
  if (url.includes("bing.")) return parseBing
  if (url.includes("duckduckgo")) return parseDdg
  return (html, max) => {
    const brave = parseBrave(html, max)
    if (brave.length > 0) return brave
    const bing = parseBing(html, max)
    return bing.length > 0 ? bing : parseDdg(html, max)
  }
}

// Tried in order until one returns results. Scraped engines break/block often,
// hence the chain.
const FALLBACK_BACKENDS: SearchBackend[] = [
  { url: "https://search.brave.com/search?q={query}", parse: parseBrave },
  { url: "https://www.bing.com/search?q={query}", parse: parseBing },
  { url: "https://html.duckduckgo.com/html/", parse: parseDdg },
]

async function runBackend(backend: SearchBackend, query: string, config: WebConfig): Promise<SearchResult[]> {
  const isGet = backend.url.includes("{query}")
  const target = isGet ? backend.url.replace("{query}", encodeURIComponent(query)) : backend.url
  const res = isGet
    ? await safeFetch(target, { maxBytes: config.maxBytes, timeoutMs: config.timeoutMs })
    : await safeFetch(target, {
        method: "POST",
        body: `q=${encodeURIComponent(query)}`,
        contentType: "application/x-www-form-urlencoded",
        maxBytes: config.maxBytes,
        timeoutMs: config.timeoutMs,
      })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  return backend.parse(res.text, config.maxResults)
}

export async function webSearch(query: string, config: WebConfig): Promise<SearchResult[]> {
  const backends: SearchBackend[] = []
  if (config.searchURL) backends.push({ url: config.searchURL, parse: parserFor(config.searchURL) })
  for (const backend of FALLBACK_BACKENDS) {
    if (!backends.some((b) => b.url === backend.url)) backends.push(backend)
  }

  for (const backend of backends) {
    try {
      const results = (await runBackend(backend, query, config))
        .filter((result) => !/^https?:\/\/([\w-]+\.)?bing\.com\//i.test(result.url))
        .slice(0, config.maxResults)
      if (results.length > 0) {
        recordUrls(results.map((result) => result.url))
        return results
      }
    } catch {
      // try the next backend
    }
  }
  return []
}

export async function webFetchPage(url: string, config: WebConfig): Promise<{ url: string; text: string }> {
  const parsed = new URL(url)
  assertFetchable(parsed)
  await assertPublicHost(parsed.hostname)
  if (config.fetchOnlySearchResults && !isAllowedUrl(url)) {
    throw new Error("refused: only URLs returned by web_search in this session may be fetched")
  }
  const res = await safeFetch(url, { maxBytes: config.maxBytes, timeoutMs: config.timeoutMs })
  if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`)
  const contentType = res.contentType.toLowerCase()
  let text = contentType.includes("html") ? htmlToText(res.text) : res.text
  if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}\n… (truncated)`
  return { url, text }
}
