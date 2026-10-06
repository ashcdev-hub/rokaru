// Best-effort masking of common credential shapes before content leaves a tool
// and reaches the model (or the transcript).
const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi,
  /(?:api[_-]?key|secret|token|password|passwd|auth)\s*[:=]\s*["']?[A-Za-z0-9._\-]{12,}["']?/gi,
  /\b[A-Za-z0-9._%+-]{1,64}:\/\/[^:@\s/]+:[^@\s/]+@/g, // scheme://user:pass@host
]

export function redactSecrets(input: string): string {
  let out = input
  for (const pattern of PATTERNS) out = out.replace(pattern, "[redacted]")
  return out
}
