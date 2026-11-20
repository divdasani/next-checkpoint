import { useMemo, useRef } from 'react'
import { Color, type Mesh } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { isMissionComplete } from '../state/selectors.ts'
import { MISSION_IDS, type MissionId } from '../state/types.ts'
import { Block, easing, useOwnMaterial, useTween } from './kit.tsx'
import { MISSION_COLOR, PAD_TOP, PALETTE, STOPS, type Vec3 } from './layout.ts'

// The four pads on the corners of the ring road, one per checkpoint. The avatar always
// stands on one of them, and starts on the first. Each pad has a small flag that rises and
// takes the checkpoint's color once it is complete, so finished checkpoints stay visible
// from the overview.

const PAD = 1.1
const PAD_BASE = 0.1
const INLAY = PAD_TOP - PAD_BASE
/** The pole is tall enough that a raised flag clears the avatar's head, even mid-hop. */
const POLE = 1.9
/**
 * Where each pole stands, measured from the middle of its pad as [x, z]. Behind the avatar
 * and a little to one side, so on screen the pole rises beside the avatar's head instead
 * of out of it, and always clear of the two roads that leave the pad.
 */
const POLE_OFFSET: Record<MissionId, readonly [number, number]> = {
  // The front pad has a road on both of its back sides, so its pole stands to the right.
  discover: [0.6, -0.1],
  network: [-0.6, -0.1],
  launch: [-0.6, -0.1],
  signal: [-0.1, -0.6],
}
const FLAG: Vec3 = [0.52, 0.34, 0.06]
const FLAG_LOW = 0.42
const FLAG_HIGH = PAD_BASE + POLE - FLAG[1] / 2 - 0.12

function Pad({ at, color, inner }: { at: Vec3; color: string; inner: string }) {
  return (
    <>
      <Block at={[at[0], PAD_BASE / 2, at[2]]} size={[PAD, PAD_BASE, PAD]} color={color} cast={false} />
      <Block at={[at[0], PAD_BASE + INLAY / 2, at[2]]} size={[0.7, INLAY, 0.7]} color={inner} cast={false} />
    </>
  )
}

function MissionCheckpoint({ mission }: { mission: MissionId }) {
  const { state } = useGame()
  const done = isMissionComplete(state, mission)
  const at = STOPS[mission]
  const flag = useRef<Mesh>(null)
  const colors = useMemo(() => ({ off: new Color(PALETTE.off), on: new Color(MISSION_COLOR[mission]) }), [mission])
  const material = useOwnMaterial(PALETTE.off)

  // The pole stands behind the avatar (toward the back of the screen), and the raised flag
  // flies above its head, so neither hides the other.
  const poleX = at[0] + POLE_OFFSET[mission][0]
  const poleZ = at[2] + POLE_OFFSET[mission][1]

  useTween(
    done ? 1 : 0,
    (value) => {
      material.color.lerpColors(colors.off, colors.on, value)
      if (flag.current) flag.current.position.y = FLAG_LOW + (FLAG_HIGH - FLAG_LOW) * value
    },
    { duration: 600, easing: easing.outBack },
  )

  return (
    <>
      <Pad at={at} color={MISSION_COLOR[mission]} inner={PALETTE.white} />
      <Block at={[poleX, PAD_BASE + POLE / 2, poleZ]} size={[0.07, POLE, 0.07]} color={PALETTE.ink} />
      <Block at={[poleX, PAD_BASE + POLE + 0.04, poleZ]} size={[0.13, 0.1, 0.13]} color={PALETTE.ink} cast={false} />
      <Block
        ref={flag}
        at={[poleX + FLAG[0] / 2 + 0.035, FLAG_LOW, poleZ]}
        size={FLAG}
        material={material}
        cast={false}
      />
    </>
  )
}

export function Checkpoints() {
  return (
    <>
      {MISSION_IDS.map((mission) => (
        <MissionCheckpoint key={mission} mission={mission} />
      ))}
    </>
  )
}
