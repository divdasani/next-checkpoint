import { useRef, useState } from 'react'
import { Color, type Group, type Mesh } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { missingDiscovery } from '../state/selectors.ts'
import { DISCOVERY_IDS } from '../state/types.ts'
import { ZoneShell } from './ZoneShell.tsx'
import { Block, HitTarget, easing, useOwnMaterial, usePulse, useTween } from './kit.tsx'
import { DISCOVER_KIT, MISSION_COLOR, PALETTE, ZONES, type Vec3 } from './layout.ts'

// Checkpoint one, "Spot the Gap", on the pitch deck.
// Three step posts, one pitch button, a magnifying glass, and a winners' podium. Clicking a
// post sends EXPLORE and clicking the button sends PITCH to the reducer. This file only
// draws what the state says:
//   state.discover.steps[step] -> that post's lamp turns teal, rises, and shows a white cap,
//                                 and the glass of the magnifying glass gets a little brighter
//   all three steps done       -> the pitch button turns bright teal and stands taller
//   state.discover.pitched     -> the button stays pressed in, the glass lights with one
//                                 pulse, and the second step of the podium turns teal
//   state.hint (discover)      -> a yellow ring marks the step to do next
//
// The deck is the corner nearest the camera, with the avatar's home pad right behind it.
// Everything here is low, or stands off to one side, so it never hides the avatar.

const FLOOR = ZONES.discover.floorY
const TEAL = MISSION_COLOR.discover

// Magnifying glass, measured from the floor under the middle of its ring (DISCOVER_KIT.lens).
// The glass faces +z. The handle is three blocks stepping down to the right, onto a foot.
const RING_SIZE = 1.3
const RING_BAR = 0.2
const RING_DEPTH = 0.24
const RING_BOTTOM = 0.95
const RING_MID = RING_BOTTOM + RING_SIZE / 2
const RING_SIDE: Vec3 = [RING_BAR, RING_SIZE - 2 * RING_BAR, RING_DEPTH]
const RING_BEAM: Vec3 = [RING_SIZE, RING_BAR, RING_DEPTH]
const GLASS: Vec3 = [RING_SIZE - 2 * RING_BAR + 0.04, RING_SIZE - 2 * RING_BAR + 0.04, 0.08]
const HANDLE: Vec3 = [0.34, 0.34, 0.2]
const HANDLE_STEPS: readonly Vec3[] = [
  [0.62, RING_BOTTOM - 0.09, 0],
  [0.86, RING_BOTTOM - 0.35, 0],
  [1.1, RING_BOTTOM - 0.61, 0],
]
const FOOT: Vec3 = [0.5, 0.18, 0.4]
const FOOT_AT: Vec3 = [1.27, FOOT[1] / 2, 0]
/** How bright the glass is with one, two, or three steps done. The pitch takes it to 1. */
const GLASS_PER_STEP = 0.18

// Step post: dark base, thin stem, lamp, white cap. The stem and the cap hide inside the
// lamp until it rises. The same shape as the readiness posts at the launch arch.
const BASE: Vec3 = [0.44, 0.12, 0.44]
const LAMP: Vec3 = [0.38, 0.36, 0.38]
const LAMP_RISE = 0.28
const STEM: Vec3 = [0.14, LAMP_RISE + 0.04, 0.14]
const CAP: Vec3 = [0.22, 0.1, 0.22]
const LAMP_LOW_Y = FLOOR + BASE[1] + LAMP[1] / 2
const LAMP_LOW_TOP = LAMP_LOW_Y + LAMP[1] / 2
const CAP_HIDDEN_Y = LAMP_LOW_TOP - CAP[1] / 2 - 0.01
/** A frame around the top of a low lamp: yellow for the hint, white under the pointer. */
const RING: Vec3 = [0.54, 0.1, 0.54]
const RING_Y = LAMP_LOW_TOP - RING[1] / 2 - 0.02
/** The posts stand 0.55 apart on both axes, so these click targets never overlap. */
const POST_TARGET: Vec3 = [0.54, 0.46, 0.54]

// Pitch button: a round button on a dark plinth. Its height shows its state.
const PLINTH: Vec3 = [0.84, 0.22, 0.84]
const PLINTH_TOP = FLOOR + PLINTH[1]
const BUTTON_HEIGHT = { waiting: 0.16, armed: 0.3, pressed: 0.06 } as const
const BUTTON: Vec3 = [0.6, BUTTON_HEIGHT.waiting, 0.6]
const BUTTON_TARGET: Vec3 = [1.1, 0.36, 1.1]

// Winners' podium, measured from the floor under its tallest step (DISCOVER_KIT.podium).
// The steps run along z, so on screen they read second, first, third from left to right.
const STEP_WIDTH = 0.62
const STEP_DEPTH = 0.6
const PODIUM = { first: 0.75, second: 0.55, third: 0.4 } as const
const MEDAL: Vec3 = [0.26, 0.14, 0.26]
const MEDAL_HIDDEN_Y = PODIUM.second - MEDAL[1] / 2 - 0.01

const COLOR_OFF = new Color(PALETTE.off)
const COLOR_TEAL = new Color(TEAL)
const COLOR_UNLIT = new Color(PALETTE.screenOff)
const COLOR_GLOW = new Color(PALETTE.glow)
const COLOR_STEP = new Color(PALETTE.cream)
/** A washed teal for the button while something is still missing. */
const COLOR_WAITING = new Color(PALETTE.off).lerp(COLOR_TEAL, 0.35)

/** A teal ring on a stepped handle. The glass brightens with each step and lights on the pitch. */
function MagnifyingGlass({ stepsDone, pitched }: { stepsDone: number; pitched: boolean }) {
  const lens = useRef<Group>(null)
  const glass = useOwnMaterial(PALETTE.screenOff, PALETTE.glow)

  useTween(
    pitched ? 1 : stepsDone * GLASS_PER_STEP,
    (value) => {
      glass.color.lerpColors(COLOR_UNLIT, COLOR_GLOW, value)
      glass.emissiveIntensity = 0.42 * value
    },
    { duration: 300 },
  )

  // The payoff: at the moment of the pitch the whole glass swells once, then rests.
  usePulse(pitched, (progress) => lens.current?.scale.setScalar(1 + 0.05 * Math.sin(Math.PI * progress)), 600)

  return (
    <group ref={lens} position={DISCOVER_KIT.lens as [number, number, number]}>
      <Block at={[0, RING_BOTTOM + RING_SIZE - RING_BAR / 2, 0]} size={RING_BEAM} color={TEAL} />
      <Block at={[0, RING_BOTTOM + RING_BAR / 2, 0]} size={RING_BEAM} color={TEAL} />
      <Block at={[-(RING_SIZE - RING_BAR) / 2, RING_MID, 0]} size={RING_SIDE} color={TEAL} />
      <Block at={[(RING_SIZE - RING_BAR) / 2, RING_MID, 0]} size={RING_SIDE} color={TEAL} />
      {/* No shadows on the glass: a light should not look shaded. */}
      <Block at={[0, RING_MID, 0]} size={GLASS} material={glass} cast={false} receive={false} />
      {HANDLE_STEPS.map((at) => (
        <Block key={at[0]} at={at} size={HANDLE} color={PALETTE.ink} />
      ))}
      <Block at={FOOT_AT} size={FOOT} color={PALETTE.ink} />
    </group>
  )
}

interface PostProps {
  at: Vec3
  done: boolean
  /** The reducer named this post as the next step to do. */
  hinted: boolean
  /** True while this mission is being played. */
  clickable: boolean
  onExplore: () => void
}

function Post({ at, done, hinted, clickable, onExplore }: PostProps) {
  const [x, , z] = at
  // Hover is plain React state: it changes when the pointer enters or leaves, never per frame.
  const [hovered, setHovered] = useState(false)
  const lamp = useRef<Mesh>(null)
  const cap = useRef<Mesh>(null)
  const material = useOwnMaterial(PALETTE.off, TEAL)

  // Done: the lamp turns teal (color), rises on its stem, and its white cap pops out (shape).
  useTween(
    done ? 1 : 0,
    (value) => {
      const amount = Math.min(1, Math.max(0, value))
      material.color.lerpColors(COLOR_OFF, COLOR_TEAL, amount)
      material.emissiveIntensity = 0.25 * amount
      if (lamp.current) lamp.current.position.y = LAMP_LOW_Y + LAMP_RISE * value
      if (cap.current) cap.current.position.y = CAP_HIDDEN_Y + (LAMP_RISE + CAP[1] + 0.01) * value
    },
    { duration: 380, easing: easing.outBack },
  )

  return (
    <>
      <Block at={[x, FLOOR + BASE[1] / 2, z]} size={BASE} color={PALETTE.ink} />
      <Block at={[x, FLOOR + BASE[1] + STEM[1] / 2, z]} size={STEM} color={PALETTE.ink} cast={false} />
      <Block ref={lamp} at={[x, LAMP_LOW_Y, z]} size={LAMP} material={material} />
      <Block ref={cap} at={[x, CAP_HIDDEN_Y, z]} size={CAP} color={PALETTE.white} cast={false} />
      {!done && (hinted || hovered) && (
        <Block at={[x, RING_Y, z]} size={RING} color={hinted ? PALETTE.yellow : PALETTE.white} cast={false} />
      )}
      {/* A finished post keeps its target, so a repeat click lands on it and changes nothing. */}
      <HitTarget
        enabled={clickable}
        at={[x, FLOOR + POST_TARGET[1] / 2, z]}
        size={POST_TARGET}
        onActivate={onExplore}
        onHoverChange={setHovered}
      />
    </>
  )
}

interface PitchButtonProps {
  /** All three steps are done. */
  armed: boolean
  pitched: boolean
  /** Counts presses that came too early, so each one gets a small "not yet" dip. */
  refusals: number
  clickable: boolean
  onPitch: () => void
}

function PitchButton({ armed, pitched, refusals, clickable, onPitch }: PitchButtonProps) {
  const [x, , z] = DISCOVER_KIT.button
  const button = useRef<Mesh>(null)
  const material = useOwnMaterial(PALETTE.off)
  // The height tween and the refusal dip both move the button, so they share one pose.
  const pose = useRef({ height: BUTTON_HEIGHT.waiting as number, dip: 0 })

  const placeButton = () => {
    const mesh = button.current
    if (!mesh) return
    const height = Math.max(0.03, pose.current.height - pose.current.dip)
    mesh.scale.y = height
    mesh.position.y = PLINTH_TOP + height / 2
  }

  // Waiting sits low, armed stands tall, pitched stays pressed in.
  useTween(
    pitched ? BUTTON_HEIGHT.pressed : armed ? BUTTON_HEIGHT.armed : BUTTON_HEIGHT.waiting,
    (value) => {
      pose.current.height = value
      placeButton()
    },
    { duration: 260, easing: easing.outBack },
  )

  useTween(armed ? 1 : 0, (value) => material.color.lerpColors(COLOR_WAITING, COLOR_TEAL, value), { duration: 260 })

  // Pressed too early: one quick dip. The HTML panel explains what is missing.
  usePulse(
    refusals,
    (progress) => {
      pose.current.dip = refusals > 0 ? 0.09 * Math.sin(Math.PI * progress) : 0
      placeButton()
    },
    240,
  )

  return (
    <>
      <Block at={[x, FLOOR + PLINTH[1] / 2, z]} size={PLINTH} color={PALETTE.ink} />
      <Block ref={button} at={[x, PLINTH_TOP + BUTTON[1] / 2, z]} size={BUTTON} material={material} shape="cylinder" />
      <HitTarget
        enabled={clickable}
        at={[x, FLOOR + BUTTON_TARGET[1] / 2, z]}
        size={BUTTON_TARGET}
        onActivate={onPitch}
      />
    </>
  )
}

/** Three steps. Once the concept is pitched, the second one turns teal and a white marker rises on it. */
function Podium({ pitched }: { pitched: boolean }) {
  const medal = useRef<Mesh>(null)
  const second = useOwnMaterial(PALETTE.cream, TEAL)

  useTween(
    pitched ? 1 : 0,
    (value) => {
      const amount = Math.min(1, Math.max(0, value))
      second.color.lerpColors(COLOR_STEP, COLOR_TEAL, amount)
      second.emissiveIntensity = 0.2 * amount
      if (medal.current) medal.current.position.y = MEDAL_HIDDEN_Y + (MEDAL[1] + 0.01) * value
    },
    { duration: 420, delay: 200, easing: easing.outBack },
  )

  return (
    <group position={DISCOVER_KIT.podium as [number, number, number]}>
      <Block at={[0, PODIUM.first / 2, 0]} size={[STEP_WIDTH, PODIUM.first, STEP_DEPTH]} color={PALETTE.cream} />
      <Block
        at={[0, PODIUM.second / 2, STEP_DEPTH]}
        size={[STEP_WIDTH, PODIUM.second, STEP_DEPTH]}
        material={second}
      />
      <Block at={[0, PODIUM.third / 2, -STEP_DEPTH]} size={[STEP_WIDTH, PODIUM.third, STEP_DEPTH]} color={PALETTE.stone} />
      <Block
        ref={medal}
        at={[0, MEDAL_HIDDEN_Y, STEP_DEPTH]}
        size={MEDAL}
        color={PALETTE.white}
        shape="cylinder"
        cast={false}
      />
    </group>
  )
}

export function DiscoverZone() {
  const { state, dispatch } = useGame()
  const { steps, pitched } = state.discover
  const playing = state.activeMission === 'discover' && !pitched
  const hint = state.hint?.mission === 'discover' ? state.hint : null
  const missing = missingDiscovery(state).length

  return (
    <ZoneShell id="discover">
      <MagnifyingGlass stepsDone={DISCOVERY_IDS.length - missing} pitched={pitched} />
      {DISCOVERY_IDS.map((step) => (
        <Post
          key={step}
          at={DISCOVER_KIT.posts[step]}
          done={steps[step]}
          hinted={hint?.next === step}
          clickable={playing}
          onExplore={() => dispatch({ type: 'EXPLORE', step })}
        />
      ))}
      <PitchButton
        armed={missing === 0}
        pitched={pitched}
        refusals={hint?.attempts ?? 0}
        clickable={playing}
        onPitch={() => dispatch({ type: 'PITCH' })}
      />
      <Podium pitched={pitched} />
    </ZoneShell>
  )
}
