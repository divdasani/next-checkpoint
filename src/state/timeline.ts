import type { MissionAction } from './types.ts'

// The one guided sequence used by both Guided tour and Film mode.
// Each row is [delay after the previous step in ms, action, note]. The actions are the
// same ones a visitor triggers by clicking, so the tour can never drift from the game rules.
// The four checkpoints are visited in trail order: Discover, Build, Ship, Scale.

export interface TourStep {
  /** Milliseconds from the start of the sequence. */
  at: number
  /** null marks a pure hold (used for the final beat). */
  action: MissionAction | null
  note: string
}

/**
 * How long each checkpoint card stays up so it can be read on a recording. While the
 * sequence plays, a card shows its stamp, its headline numbers, and the skills it unlocks.
 * The longest one (Scale) is about 40 words, which takes about 12 seconds at an easy
 * 200 words per minute.
 */
export const CARD_HOLD_MS = 12500
/**
 * Opening hold on the unfinished world. The panel shows the trail's byline, the headline,
 * and what the site demonstrates: about 26 words, so about 8 seconds.
 */
export const OPENING_HOLD_MS = 8000
/** Final hold on the finished trail before the sequence is marked done. The screen then stays up. */
export const FINALE_HOLD_MS = 5500

type Row = readonly [delay: number, action: MissionAction | null, note: string]

const connect = (index: number): MissionAction => ({ type: 'CONNECT_COMPANY', index })

const SCRIPT: readonly Row[] = [
  [OPENING_HOLD_MS, { type: 'SELECT_MISSION', mission: 'discover' }, 'Checkpoint 1: turn to the pitch deck'],
  [1300, { type: 'EXPLORE', step: 'research' }, 'Research done'],
  [650, { type: 'EXPLORE', step: 'need' }, 'Unmet need named'],
  [650, { type: 'EXPLORE', step: 'concept' }, 'Concept shaped'],
  [900, { type: 'PITCH' }, 'Pitch, the lens lights, card appears'],

  // Choosing the next destination closes the open card, exactly as it does for a visitor,
  // so the card changes straight into the next mission without an in-between screen.
  [CARD_HOLD_MS, { type: 'SELECT_MISSION', mission: 'signal' }, 'Leave the first card, travel to the signal station'],
  [1900, { type: 'ACTIVATE_SOURCE', source: 'revenue' }, 'Switch on Revenue'],
  [650, { type: 'ACTIVATE_SOURCE', source: 'invoices' }, 'Switch on Invoice volume'],
  [650, { type: 'ACTIVATE_SOURCE', source: 'inquiries' }, 'Switch on Customer inquiries'],
  [900, { type: 'START_FEED' }, 'Start the automated feed, bars align, card appears'],

  [CARD_HOLD_MS, { type: 'SELECT_MISSION', mission: 'launch' }, 'Leave the second card, travel to the launch arch'],
  [1700, { type: 'PREPARE', item: 'requirements' }, 'Requirements ready'],
  [650, { type: 'PREPARE', item: 'uat' }, 'User acceptance testing ready'],
  [650, { type: 'PREPARE', item: 'comms' }, 'Communications ready'],
  [900, { type: 'LAUNCH' }, 'Launch, arch lights, card appears'],

  [CARD_HOLD_MS, { type: 'SELECT_MISSION', mission: 'network' }, 'Leave the third card, travel to the hub'],
  [1500, connect(0), 'Connect company A'],
  [330, connect(1), 'Connect company B'],
  [330, connect(2), 'Connect company C'],
  [330, connect(3), 'Connect company D'],
  [330, connect(4), 'Connect company E'],
  [330, connect(5), 'Connect company F'],
  [330, connect(6), 'Connect company G'],
  [330, connect(7), 'Connect company H, hub lights, card appears'],

  [CARD_HOLD_MS, { type: 'DISMISS_CARD' }, 'Close the fourth card, the finished trail appears'],
  [FINALE_HOLD_MS, null, 'Hold on the finale'],
]

function build(rows: readonly Row[]): TourStep[] {
  let at = 0
  return rows.map(([delay, action, note]) => {
    at += delay
    return { at, action, note }
  })
}

export const TOUR_STEPS: readonly TourStep[] = build(SCRIPT)

/** Total length of the guided sequence in milliseconds. */
export const TOUR_DURATION_MS: number = TOUR_STEPS[TOUR_STEPS.length - 1].at
