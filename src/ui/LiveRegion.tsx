import { useEffect, useRef, useState } from 'react'
import { content, missionContent } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import { completedCount, isMissionComplete } from '../state/selectors.ts'
import { MISSION_IDS, type GameState } from '../state/types.ts'

// Screen readers cannot see the world change, so this hidden line says what just happened:
// a checkpoint was selected or completed (and its stamp earned), a step is still missing,
// the trail was finished, or the guided sequence was paused, resumed, or restarted. It compares the previous state with the
// new one, so it works the same for clicks, keyboard input, and the guided timeline.

/** A non-breaking space, written as an escape so it stays visible in the source. */
const NBSP = '\u00A0'

/** The one sentence worth announcing for a state change, or null when there is none. */
function describeChange(before: GameState, after: GameState): string | null {
  // The resume dialog has the reader's attention. Do not talk over it.
  if (after.resumeOpen) return null

  // Guided tour and Film mode controls.
  if (after.mode !== 'play') {
    const name = after.mode === 'film' ? 'Film take' : content.intro.tourLabel
    const was = before.tour.status
    const now = after.tour.status
    if (before.mode === after.mode && before.tour.runId !== after.tour.runId) return `${name} restarted.`
    if (before.mode === 'play' && now === 'running') return `${name} started.`
    if (was === 'ready' && now === 'running') return `${name} started.`
    if (was === 'running' && now === 'paused') return `${name} paused.`
    // Opening the resume pauses the sequence quietly. Say so once the resume is closed again.
    if (before.resumeOpen && now === 'paused') return `${name} paused.`
    if (was === 'paused' && now === 'running') return `${name} resumed.`
    if (was === 'running' && now === 'done') return `${name} finished.`
  }

  const { trail } = content
  if (before.phase !== 'finale' && after.phase === 'finale') return `${trail.complete}. ${content.finale.heading}`

  for (const id of MISSION_IDS) {
    if (!isMissionComplete(before, id) && isMissionComplete(after, id)) {
      const { completeLine, checkpoint, evidence } = missionContent(id)
      const earned = `${trail.stampEarned(checkpoint.stamp)}. ${content.overview.progress(completedCount(after))}.`
      // In play mode focus moves to the checkpoint card and the reader reads it there.
      // The guided sequence never moves focus, and a Film take leaves the statement off its
      // card, so the statement is read out here instead.
      if (after.mode === 'play') return `${completeLine} ${earned}`
      return `${completeLine} ${earned} ${content.cardLabels.realExperience}: ${evidence.quote}`
    }
  }

  // Pitch, Feed, or Launch was pressed too early. This is the same sentence the panel shows.
  const { hint } = after
  if (hint && hint !== before.hint) {
    if (hint.mission === 'discover') {
      const { blocked, steps } = content.missions.discover
      return blocked(hint.missing.map((id) => steps[id]))
    }
    if (hint.mission === 'signal') {
      const { blocked, sources } = content.missions.signal
      return blocked(hint.missing.map((id) => sources[id]))
    }
    const { blocked, readiness } = content.missions.launch
    return blocked(hint.missing.map((id) => readiness[id]))
  }

  if (after.activeMission && after.activeMission !== before.activeMission) {
    const mission = missionContent(after.activeMission)
    return `${trail.checkpoint} ${mission.number}, ${mission.checkpoint.name}: ${mission.title}.`
  }

  return null
}

export function LiveRegion() {
  const { state } = useGame()
  const previous = useRef(state)
  const [message, setMessage] = useState({ text: '', count: 0 })

  // Runs after every state change. On the first render "before" and "after" are the same
  // object, so nothing is announced when the page loads.
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (before === state) return
    const text = describeChange(before, state)
    // A change with nothing to announce clears the line, so an old sentence ("Not ready to
    // launch yet") is never left behind to contradict what is on screen.
    setMessage((last) => {
      if (text) return { text, count: last.count + 1 }
      return last.text ? { text: '', count: last.count } : last
    })
  }, [state])

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message.text}
      {/* The same sentence twice in a row (pressing Launch early again) would be silent.
          An invisible trailing space on every other message makes it count as new text. */}
      {message.count % 2 === 1 ? NBSP : ''}
    </div>
  )
}
