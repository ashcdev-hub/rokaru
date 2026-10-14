/** @jsxImportSource @opentui/solid */
import { createSignal, onCleanup, onMount } from "solid-js"
import { useTimeline } from "@opentui/solid"
import { getTheme } from "../theme"
import { reduceMotion } from "../store"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Braille spinner for in-progress elements. With reduced motion it holds a
// single frame instead of animating.
export function Spinner(props: { fg?: string }) {
  const [frame, setFrame] = createSignal(0)
  onMount(() => {
    if (reduceMotion()) return
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80)
    onCleanup(() => clearInterval(id))
  })
  return <text fg={props.fg ?? getTheme().accent}>{SPINNER_FRAMES[frame()]}</text>
}

// Fade a newly-mounted subtree in (opacity 0 → 1, eased). With reduced motion
// the content renders immediately at full opacity.
export function FadeIn(props: { children: any; duration?: number }) {
  const [opacity, setOpacity] = createSignal(reduceMotion() ? 1 : 0)
  const timeline = useTimeline()
  onMount(() => {
    if (reduceMotion()) return
    timeline.add(
      { value: 0 },
      {
        value: 1,
        duration: props.duration ?? 320,
        ease: "outQuad",
        onUpdate: (anim) => setOpacity(anim.targets[0].value),
      },
    )
  })
  return <box opacity={opacity()}>{props.children}</box>
}
