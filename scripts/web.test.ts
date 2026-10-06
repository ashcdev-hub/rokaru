import { DEFAULT_CONFIG } from "../src/config"
import { toolSchemas } from "../src/tools"
import { assertFetchable, isAllowedUrl, isPrivateIPv4, isPrivateIPv6, webFetchPage, webSearch } from "../src/web"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}
function refuses(url: string): boolean {
  try {
    assertFetchable(new URL(url))
    return false
  } catch {
    return true
  }
}

// --- offline safety guards ---
check("ipv4: 127.0.0.1 blocked", isPrivateIPv4("127.0.0.1"))
check("ipv4: 10.0.0.1 blocked", isPrivateIPv4("10.0.0.1"))
check("ipv4: 192.168.1.1 blocked", isPrivateIPv4("192.168.1.1"))
check("ipv4: 169.254.169.254 blocked", isPrivateIPv4("169.254.169.254"))
check("ipv4: 8.8.8.8 allowed", !isPrivateIPv4("8.8.8.8"))
check("ipv6: ::1 blocked", isPrivateIPv6("::1"))
check("ipv6: fe80::1 blocked", isPrivateIPv6("fe80::1"))
check("ipv6: 2606:4700::1 allowed", !isPrivateIPv6("2606:4700::1"))
check("url: localhost blocked", refuses("http://localhost/"))
check("url: 127.0.0.1 blocked", refuses("http://127.0.0.1:8000/"))
check("url: file:// blocked", refuses("file:///etc/passwd"))
check("url: private IP blocked", refuses("http://192.168.0.1/"))
check("url: credentials blocked", refuses("https://user:pass@example.com/"))
check("url: public https allowed", !refuses("https://example.com/"))

// --- tool advertising ---
check(
  "schemas: web tools hidden when disabled",
  !toolSchemas(false).some((t) => t.function.name === "web_search"),
)
check(
  "schemas: web tools shown when enabled",
  toolSchemas(true).some((t) => t.function.name === "web_search"),
)

// --- live network ---
const cfg = { ...DEFAULT_CONFIG.web, enabled: true, maxResults: 4 }
try {
  const results = await webSearch("macos mlx inference", cfg)
  check("search: returned results", results.length > 0, `${results.length} results`)
  if (results.length > 0) {
    const first = results[0].url
    check("search: url allowlisted", isAllowedUrl(first), first)
    const page = await webFetchPage(first, cfg)
    check("fetch: read an allowlisted result", page.text.length > 50, `${page.text.length} chars`)
  } else {
    fail += 2
  }
  let refusedNonAllowlisted = false
  try {
    await webFetchPage("https://example.com/", cfg)
  } catch (err) {
    refusedNonAllowlisted = /only URLs returned by web_search/.test((err as Error).message)
  }
  check("fetch: non-search URL refused", refusedNonAllowlisted)

  let refusedPrivate = false
  try {
    await webFetchPage("http://169.254.169.254/latest/meta-data/", cfg)
  } catch {
    refusedPrivate = true
  }
  check("fetch: metadata address refused", refusedPrivate)
} catch (err) {
  console.log(`SKIP  live web checks (${(err as Error).message})`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
