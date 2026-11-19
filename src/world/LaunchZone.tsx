import { useRef, useState } from 'react'
import { Color, type Group, type Mesh } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { missingReadiness } from '../state/selectors.ts'
import { READINESS_IDS } from '../state/types.ts'
import { ZoneShell } from './ZoneShell.tsx'
import { Block, HitTarget, easing, useOwnMaterial, usePulse, useTween } from './kit.tsx'
import { LAUNCH_KIT, MISSION_COLOR, PALETTE, ZONES, type Vec3 } from './layout.ts'

// Mission three, "Launch Day".
// Three readiness posts, one launch button, and the arch they switch on. Clicking a post
// sends PREPARE and clicking the button sends LAUNCH to the reducer. This file only draws
// what the state says:
//   state.launch.ready[item]  -> that post's lamp turns green, rises, and shows a white cap
//   all three ready           -> the launch button turns bright coral and stands taller
//   state.launch.launched     -> the button stays pressed in and the arch lights with one pulse
//   state.hint (launch)       -> a yellow ring marks the post to prepare next

const FLOOR = ZONES.launch.floorY
const CORAL = MISSION_COLOR.launch

// Arch, measured from the middle of its base (LAUNCH_KIT.arch). The opening faces +z.
const [ARCH_W, ARCH_H] = LAUNCH_KIT.archSize
const LINTEL: Vec3 = [ARCH_W, 0.6, 0.72]
const PILLAR: Vec3 = [0.5, ARCH_H - LINTEL[1], 0.6]
/** How far each pillar stands from the middle: just inside the ends of the lintel. */
const PILLAR_X = ARCH_W / 2 - 0.05 - PILLAR[0] / 2
const LINTEL_Y = PILLAR[1] + LINTEL[1] / 2
/** The panel that lights up. It tucks into the frame and sits back from the front of the pillars. */
const PORTAL: Vec3 = [2 * PILLAR_X - PILLAR[0] + 0.1, PILLAR[1] + 0.05, 0.1]
const PORTAL_AT: Vec3 = [0, PORTAL[1] / 2, PILLAR[2] / 2 - 0.2 - PORTAL[2] / 2]
/** A small block on the front of the lintel that lights with the panel. */
const KEYSTONE: Vec3 = [0.5, 0.34, 0.16]
const KEYSTONE_AT: Vec3 = [0, LINTEL_Y, LINTEL[2] / 2 + KEYSTONE[2] / 2 - 0.02]
const KEYSTONE_GROW = 0.3

// Readiness post: dark base, thin stem, lamp, white cap. The stem and the cap hide inside
// the lamp until it rises.
const BASE: Vec3 = [0.48, 0.12, 0.48]
const LAMP: Vec3 = [0.42, 0.38, 0.42]
const LAMP_RISE = 0.3
const STEM: Vec3 = [0.16, LAMP_RISE + 0.04, 0.16]
const CAP: Vec3 = [0.24, 0.1, 0.24]
const LAMP_LOW_Y = FLOOR + BASE[1] + LAMP[1] / 2
const LAMP_LOW_TOP = LAMP_LOW_Y + LAMP[1] / 2
const CAP_HIDDEN_Y = LAMP_LOW_TOP - CAP[1] / 2 - 0.01
/** A frame around the top of a low lamp: yellow for the hint, white under the pointer. */
const RING: Vec3 = [0.62, 0.1, 0.62]
const RING_Y = LAMP_LOW_TOP - RING[1] / 2 - 0.02

// Launch button: a round button on a dark plinth. Its height shows its state.
const PLINTH: Vec3 = [0.84, 0.22, 0.84]
const PLINTH_TOP = FLOOR + PLINTH[1]
const BUTTON_HEIGHT = { waiting: 0.16, armed: 0.3, pressed: 0.06 } as const
const BUTTON: Vec3 = [0.6, BUTTON_HEIGHT.waiting, 0.6]

// The posts and the button stand where LAUNCH_KIT says: the posts in a row in front of the
// left pillar, the button centered on the doorway.
const POSTS = LAUNCH_KIT.posts
const BUTTON_AT = LAUNCH_KIT.button
/** Distance between two neighbouring posts. Their click targets are this deep, so they never overlap. */
const POST_GAP = POSTS.requirements[2] - POSTS.uat[2]

// Click targets are wide so they are easy to tap, and low so the camera's line of sight to
// the lamp behind passes over them.
const POST_TARGET: Vec3 = [0.96, 0.4, POST_GAP - 0.01]
const BUTTON_TARGET: Vec3 = [1.2, 0.36, 1.2]

const COLOR_OFF = new Color(PALETTE.off)
const COLOR_READY = new Color(PALETTE.green)
const COLOR_UNLIT = new Color(PALETTE.screenOff)
const COLOR_GLOW = new Color(PALETTE.glow)
const COLOR_CORAL = new Color(CORAL)
/** A washed coral for the button while something is still missing. */
const COLOR_WAITING = new Color(PALETTE.off).lerp(COLOR_CORAL, 0.35)

/** Two cream pillars, a coral lintel, and the dark panel and keystone that light up on launch. */
function Arch({ launched }: { launched: boolean }) {
  const arch = useRef<Group>(null)
  const keystone = useRef<Mesh>(null)
  // The panel and the keystone share one material, so they always light together.
  const light = useOwnMaterial(PALETTE.screenOff, PALETTE.glow)

  // Launched: dark turns to a warm glow (color) and the keystone grows (shape). It stays lit.
  useTween(
    launched ? 1 : 0,
    (value) => {
      light.color.lerpColors(COLOR_UNLIT, COLOR_GLOW, value)
      light.emissiveIntensity = 0.42 * value
      const grow = 1 + KEYSTONE_GROW * value
      keystone.current?.scale.set(KEYSTONE[0] * grow, KEYSTONE[1] * grow, KEYSTONE[2])
    },
    { duration: 300 },
  )

  // The payoff: at the moment of launch the whole arch swells once, then rests.
  usePulse(launched, (progress) => arch.current?.scale.setScalar(1 + 0.05 * Math.sin(Math.PI * progress)), 600)

  return (
    <group ref={arch} position={LAUNCH_KIT.arch as [number, number, number]}>
      <Block at={[-PILLAR_X, PILLAR[1] / 2, 0]} size={PILLAR} color={PALETTE.cream} />
      <Block at={[PILLAR_X, PILLAR[1] / 2, 0]} size={PILLAR} color={PALETTE.cream} />
      <Block at={[0, LINTEL_Y, 0]} size={LINTEL} color={CORAL} />
      {/* No shadows on the two lights: a light should not look shaded. */}
      <Block at={PORTAL_AT} size={PORTAL} material={light} cast={false} receive={false} />
      <Block ref={keystone} at={KEYSTONE_AT} size={KEYSTONE} material={light} cast={false} receive={false} />
    </group>
  )
}

interface PostProps {
  at: Vec3
  ready: boolean
  /** The reducer named this post as the next one to prepare. */
  hinted: boolean
  /** True while this mission is being played. */
  clickable: boolean
  onPrepare: () => void
}

function Post({ at, ready, hinted, clickable, onPrepare }: PostProps) {
  const [x, , z] = at
  // Hover is plain React state: it changes when the pointer enters or leaves, never per frame.
  const [hovered, setHovered] = useState(false)
  const lamp = useRef<Mesh>(null)
  const cap = useRef<Mesh>(null)
  const material = useOwnMaterial(PALETTE.off, PALETTE.green)

  // Ready: the lamp turns green (color), rises on its stem, and its white cap pops out (shape).
  useTween(
    ready ? 1 : 0,
    (value) => {
      const amount = Math.min(1, Math.max(0, value))
      material.color.lerpColors(COLOR_OFF, COLOR_READY, amount)
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
      {!ready && (hinted || hovered) && (
        <Block at={[x, RING_Y, z]} size={RING} color={hinted ? PALETTE.yellow : PALETTE.white} cast={false} />
      )}
      {/* A ready post keeps its target, so a repeat click lands on it and changes nothing. */}
      <HitTarget
        enabled={clickable}
        at={[x, FLOOR + POST_TARGET[1] / 2, z]}
        size={POST_TARGET}
        onActivate={onPrepare}
        onHoverChange={setHovered}
      />
    </>
  )
}

interface LaunchButtonProps {
  /** All three checks are ready. */
  armed: boolean
  launched: boolean
  /** Counts presses that came too early, so each one gets a small "not yet" dip. */
  refusals: number
  clickable: boolean
  onLaunch: () => void
}

function LaunchButton({ armed, launched, refusals, clickable, onLaunch }: LaunchButtonProps) {
  const [x, , z] = BUTTON_AT
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

  // Waiting sits low, armed stands tall, launched stays pressed in.
  useTween(
    launched ? BUTTON_HEIGHT.pressed : armed ? BUTTON_HEIGHT.armed : BUTTON_HEIGHT.waiting,
    (value) => {
      pose.current.height = value
      placeButton()
    },
    { duration: 260, easing: easing.outBack },
  )

  useTween(armed ? 1 : 0, (value) => material.color.lerpColors(COLOR_WAITING, COLOR_CORAL, value), { duration: 260 })

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
        onActivate={onLaunch}
      />
    </>
  )
}

export function LaunchZone() {
  const { state, dispatch } = useGame()
  const { ready, launched } = state.launch
  const playing = state.activeMission === 'launch' && !launched
  const hint = state.hint?.mission === 'launch' ? state.hint : null

  return (
    <ZoneShell id="launch">
      <Arch launched={launched} />
      {READINESS_IDS.map((item) => (
        <Post
          key={item}
          at={POSTS[item]}
          ready={ready[item]}
          hinted={hint?.next === item}
          clickable={playing}
          onPrepare={() => dispatch({ type: 'PREPARE', item })}
        />
      ))}
      <LaunchButton
        armed={missingReadiness(state).length === 0}
        launched={launched}
        refusals={hint?.attempts ?? 0}
        clickable={playing}
        onLaunch={() => dispatch({ type: 'LAUNCH' })}
      />
    </ZoneShell>
  )
}
