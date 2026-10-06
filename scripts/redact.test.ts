import { redactSecrets } from "../src/redact"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const masked = (s: string) => redactSecrets(s).includes("[redacted]")

check("aws access key", masked("AKIAIOSFODNN7EXAMPLE"))
check("github token", masked("ghp_012345678901234567890123456789012345"))
check("openai-style key", masked("sk-abcdefghijklmnopqrstuvwxyz012345"))
check("private key block", masked("-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"))
check("bearer token", masked("Authorization: Bearer abcdef0123456789abcdef0123456789"))
check("password assignment", masked('password = "hunter2hunter2"'))
check("url credentials", masked("postgres://user:secretpass@db.example.com/x"))
check("jwt", masked("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop"))

check("keeps normal text", redactSecrets("hello world, 42 tokens") === "hello world, 42 tokens")
check("keeps short words", redactSecrets("use the token variable") === "use the token variable")

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
