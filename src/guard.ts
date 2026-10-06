const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost", "[::1]"])

export class LoopbackViolation extends Error {
  constructor(host: string) {
    super(`rokaru refuses non-loopback network access: ${host}`)
    this.name = "LoopbackViolation"
  }
}

export function assertLoopback(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new LoopbackViolation(String(rawUrl))
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new LoopbackViolation(url.hostname)
  }
  return url
}

// Strip proxy configuration so no request can be silently rerouted off-box.
export function clearProxyEnv(): void {
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "npm_config_proxy",
    "npm_config_https_proxy",
  ]) {
    delete process.env[key]
  }
  delete process.env.NO_PROXY
  delete process.env.no_proxy
}

// The only network primitive the harness is allowed to use.
export function guardedFetch(input: string, init?: RequestInit): Promise<Response> {
  assertLoopback(input)
  return fetch(input, init)
}
