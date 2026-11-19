import type { MissionAction } from './types.ts'

// The one guided sequence used by both Guided tour and Film mode.
// Each row is [delay after the previous step in ms, action, note]. The actions are the
// same ones a visitor triggers by clicking, so the tour can never drift from the game rules.

export interface TourStep {
  /** Milliseconds from the start of the sequence. */
  at: number
  /** null marks a pure hold (used for the final beat). */
  action: MissionAction | null
  note: string
}

/**
 * How long each Real experience card stays up so it can be read on a recording.
 * The longest card is about 34 words (the label, the statement, and its two supporting
 * labels), which takes about 10 seconds at an easy 200 words per minute.
 */
export const CARD_HOLD_MS = 11000
/** Opening hold on the unfinished world and identity. */
export const OPENING_HOLD_MS = 4000
/** Final hold on "Next checkpoint: Roblox." before the sequence is marked done. */
export const FINALE_HOLD_MS = 6500

type Row = readonly [delay: number, action: MissionAction | null, note: string]

const connect = (index: number): MissionAction => ({ type: 'CONNECT_COMPANY', index })

const SCRIPT: readonly Row[] = [
  [OPENING_HOLD_MS, { type: 'SELECT_MISSION', mission: 'network' }, 'Travel to the hub'],
  [1500, connect(0), 'Connect company A'],
  [330, connect(1), 'Connect company B'],
  [330, connect(2), 'Connect company C'],
  [330, connect(3), 'Connect company D'],
  [330, connect(4), 'Connect company E'],
  [330, connect(5), 'Connect company F'],
  [330, connect(6), 'Connect company G'],
  [330, connect(7), 'Connect company H, hub lights, card appears'],

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

  [CARD_HOLD_MS, { type: 'DISMISS_CARD' }, 'Close the third card, finale appears'],
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
