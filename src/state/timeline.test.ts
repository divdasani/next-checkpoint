import { describe, expect, it } from 'vitest'
import { content } from '../content/content.ts'
import { createInitialState, gameReducer } from './reducer.ts'
import { TOUR_DURATION_MS, TOUR_STEPS } from './timeline.ts'
import { completedCount } from './selectors.ts'
import {
  COMPANY_COUNT,
  DISCOVERY_IDS,
  MISSION_IDS,
  READINESS_IDS,
  SOURCE_IDS,
  type GameState,
  type MissionId,
} from './types.ts'

// The guided sequence is a list of timed steps. These tests play that list through the
// real reducer and check two things: the story it tells (same rules as a visitor, nothing
// skipped) and its timing (65 to 85 seconds, with every screen held long enough to read).

// Helpers ---------------------------------------------------------------------

/** Lock a state and everything inside it. Any attempt to change it in place then throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
  }
  return value
}

/** One step of the sequence together with the state just before and just after it. */
interface Frame {
  index: number
  /** Milliseconds from the start of the sequence. */
  at: number
  before: GameState
  after: GameState
}

/** Play the whole sequence through the reducer, one TOUR_STEP per scripted step. */
function replay(start: GameState): Frame[] {
  const frames: Frame[] = []
  let state = start
  TOUR_STEPS.forEach((step, index) => {
    const after = gameReducer(deepFreeze(state), { type: 'TOUR_STEP', runId: state.tour.runId, index })
    frames.push({ index, at: step.at, before: state, after })
    state = after
  })
  return frames
}

/** The part of the state that is the world itself: no mode, timeline position, or resume flag. */
function world(state: GameState) {
  const { phase, activeMission, avatarStop, discover, signal, launch, network, card, hint, cheers } = state
  return { phase, activeMission, avatarStop, discover, signal, launch, network, card, hint, cheers }
}

function finished(state: GameState): Record<MissionId, boolean> {
  return {
    discover: state.discover.pitched,
    signal: state.signal.feedOn,
    launch: state.launch.launched,
    network: state.network.connected.every(Boolean),
  }
}

/** How long a text takes to read at an easy 200 words a minute, in milliseconds. */
function readingTime(parts: readonly string[]): number {
  const words = parts.join(' ').split(/\s+/).filter(Boolean).length
  return (words / 200) * 60_000
}

const tourFrames = () => replay(createInitialState({ mode: 'tour' }))

/** The first step after which something is true. Fails the test if that never happens. */
function firstFrame(frames: Frame[], reached: (state: GameState) => boolean, what: string): Frame {
  const frame = frames.find(({ after }) => reached(after))
  if (!frame) throw new Error(`The guided sequence never reached: ${what}`)
  return frame
}

// Tests -----------------------------------------------------------------------

describe('timing of the guided sequence', () => {
  it('lists its steps in strictly increasing time order', () => {
    expect(TOUR_STEPS.length).toBeGreaterThan(0)
    for (let index = 1; index < TOUR_STEPS.length; index++) {
      const step = TOUR_STEPS[index]
      expect(step.at, `step ${index} (${step.note})`).toBeGreaterThan(TOUR_STEPS[index - 1].at)
    }
  })

  // With three missions the sequence had to last 40 to 60 seconds. The fourth checkpoint
  // adds a card, and Annika chose a longer sequence over shorter cards (19 November 2026).
  it('lasts between 65 and 85 seconds, measured to its last step', () => {
    expect(TOUR_DURATION_MS).toBe(TOUR_STEPS[TOUR_STEPS.length - 1].at)
    expect(TOUR_DURATION_MS).toBeGreaterThanOrEqual(65_000)
    expect(TOUR_DURATION_MS).toBeLessThanOrEqual(85_000)
  })

  it('holds on the unfinished world for at least 3 seconds before anything happens', () => {
    const frames = tourFrames()
    const changed = ({ before, after }: Frame) => JSON.stringify(world(after)) !== JSON.stringify(world(before))
    const firstChange = frames.find(changed)
    expect(firstChange).toBeDefined()
    expect(firstChange?.at).toBeGreaterThanOrEqual(3_000)
  })

  it('holds the opening long enough to read the byline and the headline', () => {
    // The first panel of the sequence (ui/panels/OverviewPanel.tsx, while busy) also shows
    // what the site demonstrates. That third line is deliberately not counted: on
    // 19 November 2026 Annika asked for a quicker start, because the opening looked as if
    // nothing was happening. The same sentence stays in view under the world on wide
    // screens, and it is in the passport view.
    const shown = [content.trail.byline, content.intro.opening]
    expect(TOUR_STEPS[0].at).toBeGreaterThanOrEqual(readingTime(shown))
    // And it is quicker than the 8 seconds she found too long.
    expect(TOUR_STEPS[0].at).toBeLessThanOrEqual(5_000)
  })

  it.each(MISSION_IDS)('keeps the %s card on screen long enough to read it at 200 words a minute', (mission) => {
    const frames = tourFrames()
    const opened = firstFrame(frames, (state) => state.card === mission, `${mission} card opens`)
    const closed = frames.find((frame) => frame.index > opened.index && frame.after.card !== mission)
    expect(closed, `the ${mission} card is closed again`).toBeDefined()
    // What a card shows in a Film take (ui/panels/EvidenceCard.tsx): "Checkpoint complete"
    // and the checkpoint's name, the stamp line, the passport count, the results, the teams,
    // steps, or takeaway, and the skills. That part has to be readable in the time.
    //
    // The Guided tour shows the full card, with the statement under these parts, for the
    // same length of time. The statement is deliberately not counted: on 19 November 2026
    // Annika chose to keep the tour's pace over holding each card for twice as long, and a
    // visitor who wants to read every word can pause.
    const { checkpoint } = content.missions[mission]
    const { trail } = content
    const shown = [
      trail.checkpointComplete,
      checkpoint.name,
      trail.stampEarned(checkpoint.stamp),
      trail.count(completedCount(opened.after)),
      ...checkpoint.metrics.flatMap((metric) => [metric.value, metric.label]),
      ...(checkpoint.teams ?? []),
      ...(checkpoint.flow ?? []),
      checkpoint.theme ?? '',
      trail.skillsUnlocked,
      ...checkpoint.skills,
    ]
    expect((closed?.at ?? 0) - opened.at).toBeGreaterThanOrEqual(readingTime(shown))
  })

  it.each(MISSION_IDS)('gives the %s mission enough time to read the problem behind it', (mission) => {
    const frames = tourFrames()
    const selected = firstFrame(frames, (state) => state.activeMission === mission, `${mission} is selected`)
    const completed = firstFrame(frames, (state) => state.card === mission, `${mission} card opens`)
    // While the sequence plays, the mission panel leads with the challenge (MissionPanel.tsx).
    expect(completed.at - selected.at).toBeGreaterThanOrEqual(readingTime([content.missions[mission].checkpoint.challenge]))
  })

  it('holds on the finale for at least 5 seconds before the sequence is marked done', () => {
    const frames = tourFrames()
    const finale = firstFrame(frames, (state) => state.phase === 'finale', 'the finale')
    expect(TOUR_DURATION_MS - finale.at).toBeGreaterThanOrEqual(5_000)
    // The sequence keeps "running" during that hold, so its controls stay as they are.
    expect(finale.after.tour.status).toBe('running')
  })

  it('matches the length the intro promises, when the intro states one', () => {
    // content.intro.tourNote tells visitors roughly how long the tour takes ("about 75 seconds").
    // If that wording keeps a number, the number has to be true. Without a number there is no claim to check.
    const stated = /(\d+)\s*seconds/.exec(content.intro.tourNote)
    if (stated) expect(Math.abs(Number(stated[1]) - TOUR_DURATION_MS / 1000)).toBeLessThanOrEqual(5)
  })
})

describe('the story the guided sequence tells', () => {
  it('visits the four checkpoints in trail order: discover, signal, launch, network', () => {
    const visits = TOUR_STEPS.flatMap((step) => (step.action?.type === 'SELECT_MISSION' ? [step.action.mission] : []))
    expect(visits).toEqual(['discover', 'signal', 'launch', 'network'])
    expect(visits).toEqual([...MISSION_IDS])
  })

  it('does every step on the pitch deck, each exactly once', () => {
    const steps = TOUR_STEPS.flatMap((step) => (step.action?.type === 'EXPLORE' ? [step.action.step] : []))
    expect([...steps].sort()).toEqual([...DISCOVERY_IDS].sort())
  })

  it('connects all eight companies, each exactly once', () => {
    const connected = TOUR_STEPS.flatMap((step) => (step.action?.type === 'CONNECT_COMPANY' ? [step.action.index] : []))
    expect([...connected].sort((a, b) => a - b)).toEqual(Array.from({ length: COMPANY_COUNT }, (_, index) => index))
  })

  it('switches on every source and prepares every check, each exactly once', () => {
    const sources = TOUR_STEPS.flatMap((step) => (step.action?.type === 'ACTIVATE_SOURCE' ? [step.action.source] : []))
    const checks = TOUR_STEPS.flatMap((step) => (step.action?.type === 'PREPARE' ? [step.action.item] : []))
    expect([...sources].sort()).toEqual([...SOURCE_IDS].sort())
    expect([...checks].sort()).toEqual([...READINESS_IDS].sort())
  })

  it('never breaks a prerequisite: no "something is missing" hint ever appears', () => {
    for (const { after, index } of tourFrames()) {
      expect(after.hint, `after step ${index} (${TOUR_STEPS[index].note})`).toBeNull()
    }
  })

  it('every scripted action changes the world, so no step is wasted or silently ignored', () => {
    for (const { before, after, index } of tourFrames()) {
      const step = TOUR_STEPS[index]
      if (step.action) {
        expect(world(after), `step ${index} (${step.note})`).not.toEqual(world(before))
      } else {
        // A pure hold only lets time pass.
        expect(world(after), `step ${index} (${step.note})`).toEqual(world(before))
      }
    }
  })

  it('moves the cursor one step at a time and stays running until the very last step', () => {
    const frames = tourFrames()
    frames.forEach(({ after, index }) => {
      expect(after.tour.cursor).toBe(index + 1)
      expect(after.tour.status).toBe(index === frames.length - 1 ? 'done' : 'running')
    })
  })

  it('sends the avatar to each destination as it is selected, and to the middle of the island for the ending', () => {
    for (const { after, index } of tourFrames()) {
      const action = TOUR_STEPS[index].action
      if (action?.type === 'SELECT_MISSION') expect(after.avatarStop).toBe(action.mission)
    }
    expect(tourFrames().at(-1)?.after.avatarStop).toBe('center')
  })

  it('opens each checkpoint card at the moment its mission completes, in trail order', () => {
    const frames = tourFrames()
    const opened = frames.filter(({ before, after }) => after.card !== null && before.card !== after.card)
    expect(opened.map(({ after }) => after.card)).toEqual(['discover', 'signal', 'launch', 'network'])
    // Each card opens with one more stamp in the passport than the one before.
    expect(opened.map(({ after }) => completedCount(after))).toEqual([1, 2, 3, 4])
    for (const { before, after } of opened) {
      const mission = after.card
      if (!mission) continue
      expect(finished(before)[mission]).toBe(false)
      expect(finished(after)[mission]).toBe(true)
    }
  })

  it('ends done, in the finale, with all four missions complete and no card open', () => {
    const end = tourFrames().at(-1)?.after
    expect(end).toBeDefined()
    if (!end) return
    expect(end.tour).toMatchObject({ status: 'done', cursor: TOUR_STEPS.length })
    expect(end).toMatchObject({ phase: 'finale', card: null, activeMission: null, hint: null })
    expect(finished(end)).toEqual({ discover: true, signal: true, launch: true, network: true })
    // Four completions and the finale: one small avatar gesture each.
    expect(end.cheers).toBe(5)
  })
})

describe('one sequence and one set of rules for every mode', () => {
  it('Film mode plays exactly the same world, step for step, as the Guided tour', () => {
    const tour = tourFrames()
    const film = replay(createInitialState({ mode: 'film', autostart: true }))
    expect(film.map(({ after }) => world(after))).toEqual(tour.map(({ after }) => world(after)))
    expect(film.at(-1)?.after.mode).toBe('film')
  })

  it('a Film take started from the slate plays the same sequence', () => {
    const slate = createInitialState({ mode: 'film' })
    const film = replay(gameReducer(slate, { type: 'TOUR_PLAY' }))
    expect(film.map(({ after }) => world(after))).toEqual(tourFrames().map(({ after }) => world(after)))
  })

  it('a visitor making the same clicks by hand reaches the same world after every step', () => {
    let byHand = gameReducer(createInitialState(), { type: 'START_PLAY' })
    for (const { after, index } of tourFrames()) {
      const step = TOUR_STEPS[index]
      if (step.action) byHand = gameReducer(deepFreeze(byHand), step.action)
      expect(world(byHand), `after step ${index} (${step.note})`).toEqual(world(after))
    }
    expect(byHand.mode).toBe('play')
  })

  it('a second run after Restart tells exactly the same story', () => {
    const first = tourFrames()
    const end = first.at(-1)?.after ?? createInitialState({ mode: 'tour' })
    const second = replay(gameReducer(end, { type: 'TOUR_RESTART' }))
    expect(second.map(({ after }) => world(after))).toEqual(first.map(({ after }) => world(after)))
  })
})
