import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MeshLambertMaterial, type Group } from 'three'
import { useGame } from '../state/GameContext.tsx'
import type { StopId } from '../state/types.ts'
import { avatarConfig } from './avatarConfig.ts'
import { Block, easing, useWorld, type BlockProps } from './kit.tsx'
import { PAD_TOP, PALETTE, STOPS, type Vec3 } from './layout.ts'
import { pointAlong, routeBetween, routeFrom, routeLength } from './paths.ts'

// Annika's avatar: a few boxes, colored from avatarConfig.ts, that walk the ring road.
//
// State only says which stop the avatar belongs at (state.avatarStop) and how many
// completions to celebrate (state.cheers). Everything in between (the walk, the turn,
// the cheer) is worked out here, frame by frame, without touching React state.
//
// When the trail is complete the avatar walks to the middle of the pond, and there it
// holds a bunch of balloons and dances until the visitor moves on.

// ── Motion settings ──────────────────────────────────────────────────────────

const GROUND = PAD_TOP + 0.005 // just above the checkpoint pads the avatar stands on
const WALK_SPEED = 5.2 // road units per second, before the two limits below
const TRIP_MIN_MS = 700 // a walk never takes less than this
const TRIP_MAX_MS = 1700 // or more than this
const STEP_LENGTH = 1.25 // road distance covered by one step
const SWING = 0.6 // how far arms and legs swing while walking, in radians
const BOB = 0.04 // the small rise in the middle of each step
const TURN_MS = 70 // how quickly the avatar turns: smaller is faster
const LOOK_AHEAD_MS = 70 // start turning this long before reaching a road corner
const SETTLE_DISTANCE = 0.1 // this close to the stop, start turning to the standing pose
const CHEER_MS = 900 // length of the whole cheer
const HOP = 0.25 // height of the one hop in a cheer
const ARMS_UP = 2.45 // how far the arms lift in a cheer, in radians

// The celebration at the end of the trail.
const HOLD_LIFT = 0.9 // how high the arm with the balloons is held, as a share of ARMS_UP
const HOLD_MS = 140 // how quickly that arm goes up and the balloons appear: smaller is faster
const DANCE_EASE_MS = 180 // how quickly the dance starts and stops
const DANCE_BEAT_MS = 460 // one bounce of the dance
const DANCE_BOUNCE = 0.09 // height of each bounce
const DANCE_TWIST = 0.38 // how far the body turns from side to side, in radians
const DANCE_LEAN = 0.09 // how far it leans with each turn
const DANCE_STEP = 0.32 // how far the legs step in place
const BALLOON_SWAY = 0.12 // how far the bunch of balloons swings behind the dance

// Headings are turns around the vertical axis: 0 faces +z and a quarter turn faces +x.
const FACE_CAMERA = Math.PI / 4
const REST_FACING: Record<StopId, number> = {
  home: FACE_CAMERA,
  discover: FACE_CAMERA, // the pitch deck lies between this corner and the camera
  network: 0,
  signal: Math.PI / 2,
  launch: (5 * Math.PI) / 4, // toward the arch, away from the camera
  center: FACE_CAMERA, // the dance is for the visitor
}

// ── Body ─────────────────────────────────────────────────────────────────────
// Sizes are in world units with the feet at y = 0 and the face toward +z, so the
// avatar's left side is +x. Arms and legs hang from pivot groups so they can swing.

const HIP_Y = 0.44
const SHOULDER_Y = 0.84
const HEAD_Y = 1.16 // middle of the head: face, hair, and accessory are measured from here

/**
 * The avatar is the one thing in the world that carries a little light of its own. The sun
 * comes from behind the camera's left shoulder, so a figure that turns to face the camera
 * would otherwise show its face and outfit in flat shade.
 */
const SELF_LIGHT = 0.26
const partMaterials = new Map<string, MeshLambertMaterial>()

function partMaterial(color: string): MeshLambertMaterial {
  let material = partMaterials.get(color)
  if (!material) {
    material = new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: SELF_LIGHT })
    partMaterials.set(color, material)
  }
  return material
}

/** One box of the avatar. Same as a Block, but drawn with the avatar's own softly lit material. */
function Part({ color = '#ffffff', ...box }: BlockProps) {
  return <Block material={partMaterial(color)} {...box} />
}

type Pivot = RefObject<Group | null>
type Rig = Record<'root' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'balloons', Pivot>
type Side = 1 | -1
const SIDES: readonly Side[] = [1, -1]

/** The same box on the left side and on the right side. */
function Pair({ at, ...box }: BlockProps) {
  return SIDES.map((side) => <Part key={side} at={[side * at[0], at[1], at[2]]} {...box} />)
}

function Leg({ side, pivot }: { side: Side; pivot: Pivot }) {
  return (
    <group ref={pivot} position={[side * 0.115, HIP_Y, 0]}>
      <Part at={[0, -0.165, 0]} size={[0.19, 0.33, 0.22]} color={avatarConfig.trousers} />
      <Part at={[0, -0.385, 0.02]} size={[0.21, 0.11, 0.27]} color={avatarConfig.shoes} />
    </group>
  )
}

function Arm({ side, pivot }: { side: Side; pivot: Pivot }) {
  return (
    <group ref={pivot} position={[side * 0.3, SHOULDER_Y, 0]}>
      <Part at={[0, -0.035, 0]} size={[0.12, 0.2, 0.19]} color={avatarConfig.top} />
      <Part at={[0, -0.265, 0]} size={[0.105, 0.26, 0.165]} color={avatarConfig.skin} />
    </group>
  )
}

/** Two eyes and a small smile on the front of the head. */
function Face() {
  const color = avatarConfig.face
  return (
    <>
      <Pair at={[0.125, 0.04, 0.255]} size={[0.08, 0.1, 0.02]} color={color} cast={false} />
      <Part at={[0, -0.15, 0.255]} size={[0.12, 0.045, 0.02]} color={color} cast={false} />
      <Pair at={[0.08, -0.1075, 0.255]} size={[0.04, 0.04, 0.02]} color={color} cast={false} />
    </>
  )
}

/**
 * Every style shares the cap on top. The bob adds chin-length hair at the back and two
 * side locks that frame the face. Long hair is the bob grown out: the hair at the back and
 * the side locks reach the shoulders, a fall hangs down the back, and two strands rest on
 * the chest. The other two styles are cropped close, and the ponytail adds a knot on top
 * with a tail behind.
 */
function Hair() {
  const { hair, hairStyle } = avatarConfig
  const long = hairStyle === 'long'
  const framed = long || hairStyle === 'bob' // hair down the back and the sides of the head
  // That hair starts under the cap. These are its middle and its height at the back and at the sides.
  const backY = long ? -0.03 : framed ? 0.015 : 0.07
  const backHeight = long ? 0.44 : framed ? 0.35 : 0.24
  const lockY = long ? -0.01 : 0.015
  const lockHeight = long ? 0.4 : 0.35
  return (
    <>
      <Part at={[0, 0.245, 0]} size={[0.62, 0.11, 0.56]} color={hair} />
      <Part at={[0, backY, -0.24]} size={[0.62, backHeight, 0.08]} color={hair} />
      {framed ? (
        <Pair at={[0.28, lockY, 0.04]} size={[0.06, lockHeight, 0.48]} color={hair} />
      ) : (
        <Pair at={[0.285, 0.115, -0.07]} size={[0.05, 0.15, 0.26]} color={hair} />
      )}
      {long && (
        <>
          {/* The fall down the back. It is narrower than the shoulders, so the arms swing past it. */}
          <Part at={[0, -0.38, -0.205]} size={[0.46, 0.36, 0.15]} color={hair} />
          {/* Two strands over the front of the shoulders, inside the arms for the same reason. */}
          <Pair at={[0.18, -0.35, 0.1525]} size={[0.11, 0.3, 0.045]} color={hair} />
        </>
      )}
      {hairStyle === 'ponytail' && (
        <>
          <Part at={[0, 0.33, -0.21]} size={[0.16, 0.14, 0.18]} color={hair} />
          <Part at={[0, 0.12, -0.345]} size={[0.14, 0.44, 0.15]} color={hair} />
        </>
      )}
    </>
  )
}

/** The one small accent: a band over the head, a bow on top, or nothing. */
function Accessory() {
  const { accessory, accessoryStyle } = avatarConfig
  if (accessoryStyle === 'headband') {
    return (
      <>
        <Part at={[0, 0.315, 0.07]} size={[0.68, 0.05, 0.1]} color={accessory} />
        <Pair at={[0.32, 0.195, 0.07]} size={[0.04, 0.19, 0.1]} color={accessory} />
      </>
    )
  }
  if (accessoryStyle === 'bow') {
    return (
      <>
        <Part at={[0.15, 0.335, 0.07]} size={[0.07, 0.08, 0.08]} color={accessory} />
        <Part at={[0.065, 0.345, 0.07]} size={[0.11, 0.11, 0.06]} color={accessory} />
        <Part at={[0.235, 0.345, 0.07]} size={[0.11, 0.11, 0.06]} color={accessory} />
      </>
    )
  }
  return null
}

// ── Balloons ─────────────────────────────────────────────────────────────────
// Three blocky balloons on strings, held in the avatar's left hand at the end of the trail.

/** Where that hand is while the arm is held up (HOLD_LIFT), measured like the rest of the body. */
const HAND: Vec3 = [0.62, 1.08, 0]

/**
 * Each balloon's color, its middle measured from the hand, and its size. Seen from the
 * camera the first one floats in front of the coral launch pad, so it is the blue one.
 */
const BALLOONS: readonly { color: string; at: Vec3; size: Vec3 }[] = [
  { color: PALETTE.blue, at: [-0.34, 1.42, 0.05], size: [0.42, 0.5, 0.42] },
  { color: PALETTE.yellow, at: [0.12, 1.72, -0.07], size: [0.46, 0.54, 0.46] },
  { color: PALETTE.coral, at: [0.56, 1.36, 0.06], size: [0.4, 0.48, 0.4] },
]

function Balloon({ color, at, size }: (typeof BALLOONS)[number]) {
  const [x, y, z] = at
  const bottom = y - size[1] / 2
  // The string runs from the hand (the middle of this group) to just under the knot.
  const end: Vec3 = [x, bottom - 0.07, z]
  const length = Math.hypot(...end)
  return (
    <>
      <Part at={at} size={size} color={color} />
      <Part at={[x, bottom - 0.035, z]} size={[0.11, 0.07, 0.11]} color={color} />
      {/* A small square of shine on the side that faces the visitor. */}
      <Part
        at={[x - size[0] * 0.22, y + size[1] * 0.2, z + size[2] / 2 + 0.006]}
        size={[size[0] * 0.2, size[1] * 0.22, 0.012]}
        color={PALETTE.white}
        cast={false}
      />
      <Part
        at={[end[0] / 2, end[1] / 2, end[2] / 2]}
        size={[0.022, length, 0.022]}
        color={PALETTE.white}
        cast={false}
        rotation={[Math.atan2(end[2], end[1]), 0, -Math.asin(end[0] / length)]}
      />
    </>
  )
}

function Balloons({ pivot }: { pivot: Pivot }) {
  return (
    <group ref={pivot} position={HAND as [number, number, number]} visible={false}>
      {BALLOONS.map((balloon) => (
        <Balloon key={balloon.color} {...balloon} />
      ))}
    </group>
  )
}

function Body({ rig }: { rig: Rig }) {
  return (
    <group ref={rig.root}>
      <Leg side={1} pivot={rig.legLeft} />
      <Leg side={-1} pivot={rig.legRight} />
      <Part at={[0, 0.45, 0]} size={[0.44, 0.1, 0.25]} color={avatarConfig.trousers} />
      <Part at={[0, 0.705, 0]} size={[0.46, 0.43, 0.27]} color={avatarConfig.top} />
      <Arm side={1} pivot={rig.armLeft} />
      <Arm side={-1} pivot={rig.armRight} />
      <group position={[0, HEAD_Y, 0]}>
        <Part at={[0, 0, 0]} size={[0.56, 0.5, 0.5]} color={avatarConfig.skin} />
        <Face />
        <Hair />
        <Accessory />
      </group>
      <Balloons pivot={rig.balloons} />
    </group>
  )
}

// ── Motion ───────────────────────────────────────────────────────────────────
// Everything that changes from frame to frame lives in one plain object kept in a ref,
// so moving the avatar never makes React render again.

interface Trip {
  route: Vec3[]
  length: number
  start: number // timestamps and durations are in milliseconds
  duration: number
  phaseFrom: number // walk cycle angle when the trip starts and when it ends
  phaseTo: number
}

interface Motion {
  // The last values seen in state, to tell what changed.
  stop: StopId
  cheers: number
  epoch: number
  // Where the avatar is and which way it faces right now.
  x: number
  y: number // height above the pads: 0 on the road, a little lower in the pond
  z: number
  heading: number
  facing: number // the heading to settle into while standing
  trip: Trip | null
  phase: number // walk cycle angle: every half turn is one step, and 0 is the rest pose
  cheerStart: number | null
  cheerQueued: boolean // a cheer waiting for the walk, or an earlier cheer, to finish
  // The celebration at the end of the trail.
  party: boolean // the trail is complete and the avatar belongs in the middle of the pond
  paused: boolean // the resume covers the world, so the dance waits
  hold: number // 0 to 1: the arm with the balloons going up, and the balloons appearing
  dance: number // 0 to 1: how much of the dance is mixed into the pose
  danceTime: number // milliseconds danced so far
  moving: boolean // true while the frame loop still has work to do
  lastFrame: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => clamp01(value) ** 2 * (3 - 2 * clamp01(value))

/** The avatar standing on a stop in the rest pose, with nothing in progress. */
const standing = (stop: StopId) => ({
  x: STOPS[stop][0],
  y: STOPS[stop][1],
  z: STOPS[stop][2],
  heading: REST_FACING[stop],
  facing: REST_FACING[stop],
  trip: null,
  phase: 0,
  cheerStart: null,
  cheerQueued: false,
})

/** Plan one tween over the whole route to a stop. A trip redirected mid-walk starts where the avatar is. */
function startTrip(m: Motion, to: StopId, now: number): void {
  const route = m.trip ? routeFrom([m.x, m.y, m.z], to) : routeBetween(m.stop, to)
  const length = routeLength(route)
  m.facing = REST_FACING[to]
  m.trip = {
    route,
    length,
    start: now,
    duration: Math.min(TRIP_MAX_MS, Math.max(TRIP_MIN_MS, (length / WALK_SPEED) * 1000)),
    phaseFrom: m.phase,
    // Ending on a whole number of steps brings arms and legs back to rest on arrival.
    phaseTo: Math.PI * Math.round(m.phase / Math.PI + length / STEP_LENGTH),
  }
}

/** Step a heading toward a target the shortest way round. It slows as it nears, then lands exactly on it. */
function turnToward(heading: number, target: number, elapsedMs: number): number {
  const turn = Math.atan2(Math.sin(target - heading), Math.cos(target - heading))
  return Math.abs(turn) < 0.02 ? target : heading + turn * (1 - Math.exp(-elapsedMs / TURN_MS))
}

/** Ease a value toward a target. It slows as it nears, then lands exactly on it. */
function approach(value: number, target: number, elapsedMs: number, easeMs: number): number {
  const next = value + (target - value) * (1 - Math.exp(-elapsedMs / easeMs))
  return Math.abs(target - next) < 0.003 ? target : next
}

/** Write the current motion values straight onto the 3D groups. */
function pose(rig: Rig, m: Motion, lift: number, hop: number): void {
  const swing = SWING * Math.sin(m.phase)
  // The dance: a bounce on every beat, and a turn, a lean, and a step from side to side
  // that take two beats. All of it fades in and out with m.dance.
  const beat = (m.danceTime / DANCE_BEAT_MS) * Math.PI
  const side = m.dance * Math.sin(beat)
  const bounce = m.dance * DANCE_BOUNCE * Math.abs(Math.sin(beat))
  const step = swing + DANCE_STEP * side
  rig.root.current?.position.set(m.x, GROUND + m.y + BOB * Math.sin(m.phase) ** 2 + HOP * hop + bounce, m.z)
  rig.root.current?.rotation.set(0, m.heading + DANCE_TWIST * side, DANCE_LEAN * side)
  rig.legLeft.current?.rotation.set(step, 0, 0)
  rig.legRight.current?.rotation.set(-step, 0, 0)
  // Each arm swings opposite to the leg on its own side. A cheer lifts both arms out and up.
  // At the end of the trail the left arm stays up with the balloons, and the right arm
  // waves overhead, twice to every bounce.
  const liftLeft = Math.max(lift, HOLD_LIFT * m.hold)
  const liftRight = Math.max(lift, m.dance * (0.74 + 0.2 * Math.sin(beat * 2)))
  rig.armLeft.current?.rotation.set(-swing * (1 - liftLeft), 0, ARMS_UP * liftLeft)
  rig.armRight.current?.rotation.set(swing * (1 - liftRight), 0, -ARMS_UP * liftRight)
  // The balloons grow out of the hand, stay more upright than the dancer, and swing a little behind.
  const balloons = rig.balloons.current
  if (balloons) {
    balloons.visible = m.hold > 0.01
    balloons.scale.setScalar(m.hold)
    balloons.rotation.set(0, 0, m.dance * BALLOON_SWAY * Math.sin(beat - 0.9) - 0.6 * DANCE_LEAN * side)
  }
}

export function Avatar() {
  const { avatarStop, cheers, phase, resumeOpen } = useGame().state
  const { reducedMotion, epoch } = useWorld()
  const invalidate = useThree((three) => three.invalidate)
  // The trail is complete and the avatar belongs in the middle of the pond.
  const party = phase === 'finale' && avatarStop === 'center'
  const rig: Rig = {
    root: useRef<Group>(null),
    armLeft: useRef<Group>(null),
    armRight: useRef<Group>(null),
    legLeft: useRef<Group>(null),
    legRight: useRef<Group>(null),
    balloons: useRef<Group>(null),
  }
  const motion = useRef<Motion>({
    stop: avatarStop,
    cheers,
    epoch,
    party,
    paused: resumeOpen,
    hold: party ? 1 : 0,
    dance: 0,
    danceTime: 0,
    moving: false,
    lastFrame: 0,
    ...standing(avatarStop),
  })

  // State changed: decide what to start. The frame loop below does the moving.
  useLayoutEffect(() => {
    const m = motion.current
    const now = performance.now()
    const reset = m.epoch !== epoch
    const cheered = cheers > m.cheers
    if (reset || reducedMotion) {
      // No tween: appear at the stop. A completion still turns the avatar to the camera.
      // With reduced motion the ending is a still pose: the balloons are there, the dance is not.
      Object.assign(m, standing(avatarStop))
      if (cheered && !reset) m.heading = m.facing = FACE_CAMERA
      m.hold = party ? 1 : 0
      m.dance = 0
    } else {
      if (avatarStop !== m.stop) startTrip(m, avatarStop, now)
      if (cheered) m.cheerQueued = true
    }
    m.stop = avatarStop
    m.cheers = cheers
    m.epoch = epoch
    m.party = party
    m.paused = resumeOpen
    if (!m.moving) m.lastFrame = now
    m.moving = true
    invalidate()
  }, [avatarStop, cheers, epoch, party, resumeOpen, reducedMotion, invalidate])

  useFrame(() => {
    const m = motion.current
    if (!m.moving) return
    const now = performance.now()
    const elapsed = now - m.lastFrame
    m.lastFrame = now

    // Walk: one eased tween over the whole route, facing the way the road goes.
    // When standing, and on the last short stretch of a walk, the avatar turns to its
    // standing pose instead: the stop's own facing, or the camera when a cheer is due.
    let aim = m.cheerQueued ? FACE_CAMERA : m.facing
    if (m.trip) {
      const { route, length, start, duration, phaseFrom, phaseTo } = m.trip
      const walkedAt = (time: number) => length * easing.inOutCubic(clamp01((time - start) / duration))
      const walked = walkedAt(now)
      const here = pointAlong(route, walked).position
      m.x = here[0]
      m.y = here[1]
      m.z = here[2]
      if (walked < length) {
        m.phase = phaseFrom + (phaseTo - phaseFrom) * (walked / length)
        if (length - walked > SETTLE_DISTANCE) aim = pointAlong(route, walkedAt(now + LOOK_AHEAD_MS)).heading
      } else {
        m.trip = null
        m.phase = 0
      }
    }

    // Cheer: waits until the avatar is standing, turns it to the camera, and plays once.
    if (m.cheerQueued && !m.trip && m.cheerStart === null) {
      m.cheerQueued = false
      m.cheerStart = now
      m.facing = aim = FACE_CAMERA
    }
    let lift = 0
    let hop = 0
    if (m.cheerStart !== null) {
      const progress = clamp01((now - m.cheerStart) / CHEER_MS)
      const air = clamp01((progress - 0.14) / 0.5)
      lift = smooth(progress / 0.22) * (1 - smooth((progress - 0.72) / 0.28))
      hop = 4 * air * (1 - air)
      if (progress >= 1) m.cheerStart = null
    }

    // The end of the trail: the balloons come out as soon as it is complete, and the dance
    // starts once the avatar has arrived and cheered. It keeps going until the visitor moves
    // on, and it waits while the resume covers the world.
    const holdTo = m.party ? 1 : 0
    const danceTo = m.party && !reducedMotion && !m.trip && m.cheerStart === null && !m.cheerQueued ? 1 : 0
    m.hold = reducedMotion ? holdTo : approach(m.hold, holdTo, elapsed, HOLD_MS)
    m.dance = approach(m.dance, danceTo, elapsed, DANCE_EASE_MS)
    const dancing = m.dance > 0 && !m.paused
    if (dancing) m.danceTime += elapsed

    m.heading = turnToward(m.heading, aim, elapsed)
    pose(rig, m, lift, hop)

    // The canvas only draws on demand, so ask for another frame while anything is moving.
    m.moving =
      m.trip !== null ||
      m.cheerStart !== null ||
      m.cheerQueued ||
      m.heading !== aim ||
      m.hold !== holdTo ||
      m.dance !== danceTo ||
      dancing
    if (m.moving) invalidate()
  })

  return <Body rig={rig} />
}
