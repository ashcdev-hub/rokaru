/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { skillPanelIndex, type Skill } from "../store"

function statusText(skill: Skill): string {
  if (skill.hidden) return "hidden"
  if (skill.description.length > 0) return "invocable"
  return "no description"
}

function statusColour(skill: Skill): string {
  if (skill.hidden) return getTheme().dim
  if (skill.description.length > 0) return getTheme().good
  return getTheme().warn
}

export function SkillsPanel(props: { skills: Skill[] }) {
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={72}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>skills</b>
        </text>
        <text fg={getTheme().dim}>{""}</text>
        <Show when={props.skills.length > 0} fallback={<text fg={getTheme().dim}>(no skills found)</text>}>
          <For each={props.skills}>
            {(skill, index) => (
              <text>
                <span {...sg(skillPanelIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {skillPanelIndex() === index() ? "▶ " : "  "}
                </span>
                <span {...sg(getTheme().text)}>{`${skill.id}  `}</span>
                <span {...sg(getTheme().dim)}>{`${skill.name}  `}</span>
                <span {...sg(getTheme().dim)}>{`${skill.description}  `}</span>
                <span {...sg(statusColour(skill))}>{`(${statusText(skill)})`}</span>
              </text>
            )}
          </For>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <text fg={getTheme().dim}>↑/↓ move · esc close</text>
      </box>
    </box>
  )
}
