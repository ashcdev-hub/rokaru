/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { Spinner, FadeIn } from "../src/components/anim"

const spinner = await testRender(() => <Spinner />, { width: 4, height: 2 })
await spinner.flush()
const braille = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(spinner.captureCharFrame())
spinner.renderer.destroy()

const fade = await testRender(() => <FadeIn><text>visible content</text></FadeIn>, { width: 20, height: 2 })
await fade.flush()
const caret = fade.captureCharFrame().includes("visible content")
fade.renderer.destroy()

console.log(braille ? "PASS  spinner renders a braille frame" : "FAIL  spinner")
console.log(caret ? "PASS  fade-in renders its content" : "FAIL  fade-in")
process.exit(braille && caret ? 0 : 1)
