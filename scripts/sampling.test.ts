import { DEFAULT_CONFIG, resolveSampling, type RokaruConfig } from "../src/config"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

// Defaults disable penalties (matching oMLX).
check("default repetition penalty is neutral", DEFAULT_CONFIG.sampling.repetitionPenalty === 1)
check("default minP is zero", DEFAULT_CONFIG.sampling.minP === 0)
check("default presence penalty is zero", DEFAULT_CONFIG.sampling.presencePenalty === 0)
check("no per-model overrides by default", Object.keys(DEFAULT_CONFIG.modelSampling).length === 0)

const model = "Ling-3.0-tiny-oQ6e"
const config: RokaruConfig = {
  ...DEFAULT_CONFIG,
  modelSampling: { [model]: { repetitionPenalty: 1.1, topK: 20 } },
}

const overridden = resolveSampling(config, model)
check("override applies repetition penalty", overridden.repetitionPenalty === 1.1)
check("override applies topK", overridden.topK === 20)
check("unspecified fields fall back to the global", overridden.temperature === DEFAULT_CONFIG.sampling.temperature)
check("global sampling is unchanged", config.sampling.repetitionPenalty === 1)

const other = resolveSampling(config, "SomeOtherModel")
check("other models use the global sampling", other.repetitionPenalty === 1 && other.topK === DEFAULT_CONFIG.sampling.topK)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
