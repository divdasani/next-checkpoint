// Small pieces shared by the panels: line icons, the round status mark, and the
// eyebrow separator. Nothing here reads or changes game state.

/** Icon outlines drawn on a 16 by 16 grid. They are inline so the site needs no icon files. */
const ICON_PATHS = {
  check: 'M3.4 8.6l3 3 6.2-7',
  plus: 'M8 3.6v8.8M3.6 8h8.8',
  next: 'M2.8 8h10M8.6 3.8L12.8 8l-4.2 4.2',
  back: 'M13.2 8h-10M7.4 3.8L3.2 8l4.2 4.2',
  external: 'M9.4 2.8h3.8v3.8M13 3L7.6 8.4M11.4 9.6v3.6H2.8V4.6h3.6',
  play: 'M5.2 3.4v9.2L12.8 8z',
  replay: 'M3.3 9.4a4.9 4.9 0 1 0 1-5M2.9 2.4v3.2h3.2',
  flag: 'M4 14V2.4M4 3h8.4l-2.2 2.7 2.2 2.7H4',
} as const

export type IconName = keyof typeof ICON_PATHS

/**
 * A decorative icon that takes the size and color of the text around it.
 * It is hidden from screen readers, so the words beside it must carry the meaning.
 */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className={name === 'play' ? 'panel-icon panel-icon--solid' : 'panel-icon'}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

interface StatusMarkProps {
  done: boolean
  /** Optional icon to show while the step is still to do. Without it the circle stays empty. */
  todoIcon?: IconName
}

/**
 * The round mark on a step: a check once it is done.
 * Status is never shown by color alone, so every use also has a status word next to it.
 */
export function StatusMark({ done, todoIcon }: StatusMarkProps) {
  return (
    <span className={done ? 'panel-mark is-done' : 'panel-mark'} aria-hidden="true">
      {done ? <Icon name="check" /> : todoIcon ? <Icon name={todoIcon} /> : null}
    </span>
  )
}

/**
 * The small dot between two parts of an eyebrow line. Screen readers skip the dot and get
 * a comma instead, so the two parts are read as two phrases and not run together.
 */
export function Dot() {
  return (
    <>
      <span aria-hidden="true">{' · '}</span>
      <span className="visually-hidden">, </span>
    </>
  )
}
