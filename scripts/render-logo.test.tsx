/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { AsciiLogo } from "../src/components/AsciiLogo"

const setup = await testRender(() => <AsciiLogo />, { width: 80, height: 16 })
await setup.flush()
console.log("----- LOGO FRAME -----")
console.log(setup.captureCharFrame())
console.log("----- END -----")
setup.renderer.destroy()
process.exit(0)
