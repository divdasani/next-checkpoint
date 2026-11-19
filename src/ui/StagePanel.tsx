import { useEffect, useRef, type MouseEvent } from 'react'
import { useGame } from '../state/GameContext.tsx'
import { isTourBusy, panelKind, type PanelKind } from '../state/selectors.ts'
import { EvidenceCard } from './panels/EvidenceCard.tsx'
import { FilmSlate } from './panels/FilmSlate.tsx'
import { FinalePanel } from './panels/FinalePanel.tsx'
import { IntroPanel } from './panels/IntroPanel.tsx'
import { MissionPanel } from './panels/MissionPanel.tsx'
import { OverviewPanel } from './panels/OverviewPanel.tsx'

/**
 * How long a freshly shown panel ignores mouse and touch presses. A double-click or double
 * tap on the last button of one panel would otherwise also press whatever the next panel
 * puts in the same spot: skip a Real experience card, or even press Replay.
 */
const DOUBLE_PRESS_MS = 400

function renderPanel(kind: PanelKind) {
  switch (kind) {
    case 'slate':
      return <FilmSlate />
    case 'intro':
      return <IntroPanel />
    case 'card':
      return <EvidenceCard />
    case 'finale':
      return <FinalePanel />
    case 'mission':
      return <MissionPanel />
    case 'overview':
      return <OverviewPanel />
  }
}

/**
 * Shows exactly one panel. Which one is decided by panelKind(state), the same rule in
 * every mode, so play, Guided tour, and Film mode can never show different things for
 * the same state.
 */
export function StagePanel() {
  const { state } = useGame()
  const { mode, resumeOpen } = state
  const kind = panelKind(state)
  const busy = isTourBusy(state)

  // The key names the panel on screen: its kind plus the mission it is about.
  // A new key gives a fresh element, which replays the entrance animation.
  const subject = kind === 'card' ? state.card : kind === 'mission' ? state.activeMission : null
  const key = subject ? `${kind}:${subject}` : kind

  const slot = useRef<HTMLDivElement>(null)
  const previous = useRef({ key, mode })
  /** When the panel on screen replaced another one. Nothing has been replaced at first load. */
  const swappedAt = useRef(Number.NEGATIVE_INFINITY)

  // Focus follows the panel. When a visitor presses a button and the panel it lived in is
  // replaced, keyboard focus would otherwise fall back to the top of the page. Moving it to
  // the new panel's heading keeps keyboard and screen reader users where the action is.
  useEffect(() => {
    const before = previous.current
    previous.current = { key, mode }

    const panelChanged = before.key !== key
    if (panelChanged) swappedAt.current = performance.now()
    // A new panel starts at its top, even if the last one was scrolled down (small screens).
    if (panelChanged && slot.current?.parentElement) slot.current.parentElement.scrollTop = 0

    // "Play it yourself" removes the tour controls, which loses focus the same way.
    const backToPlay = before.mode !== 'play' && mode === 'play'
    if (!panelChanged && !backToPlay) return

    // Only follow changes the visitor caused. While the guided sequence owns the world,
    // panels change on their own and focus must stay where the visitor left it (for example
    // on Pause). The Film slate is the exception: it only ever opens from the Film mode button.
    const causedByVisitor = !busy || kind === 'slate'
    if (!causedByVisitor || resumeOpen) return

    slot.current?.querySelector<HTMLElement>('[data-panel-heading]')?.focus({ preventScroll: true })
  }, [key, kind, mode, busy, resumeOpen])

  // Runs before any button in the panel sees the click. Keyboard presses (detail 0) always
  // pass: they cannot land on the wrong control, because focus moves to the heading.
  const dropSecondPress = (event: MouseEvent) => {
    if (event.detail === 0) return
    if (performance.now() - swappedAt.current < DOUBLE_PRESS_MS) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <div key={key} ref={slot} className="stage-panel__slot enter" onClickCapture={dropSecondPress}>
      {renderPanel(kind)}
    </div>
  )
}
