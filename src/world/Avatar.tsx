import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MeshLambertMaterial, type Group } from 'three'
import { useGame } from '../state/GameContext.tsx'
import type { StopId } from '../state/types.ts'
import { avatarConfig } from './avatarConfig.ts'
import { Block, easing, useWorld, type BlockProps } from './kit.tsx'
import { PAD_TOP, RING_ORDER, STOPS, type Vec3 } from './layout.ts'
import { pointAlong, routeBetween, routeLength } from './paths.ts'

// Annika's avatar: a few boxes, colored from avatarConfig.ts, that walk the ring road.
//
// State only says which stop the avatar belongs at (state.avatarStop) and how many
// completions to celebrate (state.cheers). Everything in between (the walk, the turn,
// the cheer) is worked out here, frame by frame, without touching React state.

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

// Headings are turns around the vertical axis: 0 faces +z and a quarter turn faces +x.
const FACE_CAMERA = Math.PI / 4
const REST_FACING: Record<StopId, number> = {
  home: FACE_CAMERA,
  network: 0,
  signal: Math.PI / 2,
  launch: (5 * Math.PI) / 4, // toward the arch, away from the camera
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
type Rig = Record<'root' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight', Pivot>
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
 * side locks that frame the face. The other two styles are cropped close, and the
 * ponytail adds a knot on top with a tail behind.
 */
function Hair() {
  const { hair, hairStyle } = avatarConfig
  const bob = hairStyle === 'bob'
  return (
    <>
      <Part at={[0, 0.245, 0]} size={[0.62, 0.11, 0.56]} color={hair} />
      <Part at={[0, bob ? 0.015 : 0.07, -0.24]} size={[0.62, bob ? 0.35 : 0.24, 0.08]} color={hair} />
      {bob ? (
        <Pair at={[0.28, 0.015, 0.04]} size={[0.06, 0.35, 0.48]} color={hair} />
      ) : (
        <Pair at={[0.285, 0.115, -0.07]} size={[0.05, 0.15, 0.26]} color={hair} />
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
  z: number
  heading: number
  facing: number // the heading to settle into while standing
  trip: Trip | null
  phase: number // walk cycle angle: every half turn is one step, and 0 is the rest pose
  cheerStart: number | null
  cheerQueued: boolean // a cheer waiting for the walk, or an earlier cheer, to finish
  moving: boolean // true while the frame loop still has work to do
  lastFrame: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => clamp01(value) ** 2 * (3 - 2 * clamp01(value))

/** The avatar standing on a stop in the rest pose, with nothing in progress. */
const standing = (stop: StopId) => ({
  x: STOPS[stop][0],
  z: STOPS[stop][2],
  heading: REST_FACING[stop],
  facing: REST_FACING[stop],
  trip: null,
  phase: 0,
  cheerStart: null,
  cheerQueued: false,
})

/**
 * A route for a destination chosen in the middle of a walk. The avatar is partway along
 * one road, between the two stops nearest to it. It leaves by whichever of those two
 * gives the shorter walk, so it never jumps and never cuts across the grass.
 */
function routeFromRoad(here: Vec3, to: StopId): Vec3[] {
  const distance = (stop: StopId) => Math.hypot(here[0] - STOPS[stop][0], here[2] - STOPS[stop][2])
  const [nearest, next] = [...RING_ORDER].sort((a, b) => distance(a) - distance(b))
  const one = [here, ...routeBetween(nearest, to)]
  const other = [here, ...routeBetween(next, to)]
  return routeLength(one) <= routeLength(other) ? one : other
}

/** Plan one tween over the whole route to a stop. */
function startTrip(m: Motion, to: StopId, now: number): void {
  const route = m.trip ? routeFromRoad([m.x, 0, m.z], to) : routeBetween(m.stop, to)
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

/** Write the current motion values straight onto the 3D groups. */
function pose(rig: Rig, m: Motion, lift: number, hop: number): void {
  const swing = SWING * Math.sin(m.phase)
  const armSwing = swing * (1 - lift)
  rig.root.current?.position.set(m.x, GROUND + BOB * Math.sin(m.phase) ** 2 + HOP * hop, m.z)
  rig.root.current?.rotation.set(0, m.heading, 0)
  // Each arm swings opposite to the leg on its own side. A cheer lifts both arms out and up.
  rig.legLeft.current?.rotation.set(swing, 0, 0)
  rig.legRight.current?.rotation.set(-swing, 0, 0)
  rig.armLeft.current?.rotation.set(-armSwing, 0, ARMS_UP * lift)
  rig.armRight.current?.rotation.set(armSwing, 0, -ARMS_UP * lift)
}

export function Avatar() {
  const { avatarStop, cheers } = useGame().state
  const { reducedMotion, epoch } = useWorld()
  const invalidate = useThree((three) => three.invalidate)
  const rig: Rig = {
    root: useRef<Group>(null),
    armLeft: useRef<Group>(null),
    armRight: useRef<Group>(null),
    legLeft: useRef<Group>(null),
    legRight: useRef<Group>(null),
  }
  const motion = useRef<Motion>({ stop: avatarStop, cheers, epoch, moving: false, lastFrame: 0, ...standing(avatarStop) })

  // State changed: decide what to start. The frame loop below does the moving.
  useLayoutEffect(() => {
    const m = motion.current
    const now = performance.now()
    const reset = m.epoch !== epoch
    const cheered = cheers > m.cheers
    if (reset || reducedMotion) {
      // No tween: appear at the stop. A completion still turns the avatar to the camera.
      Object.assign(m, standing(avatarStop))
      if (cheered && !reset) m.heading = m.facing = FACE_CAMERA
    } else {
      if (avatarStop !== m.stop) startTrip(m, avatarStop, now)
      if (cheered) m.cheerQueued = true
    }
    m.stop = avatarStop
    m.cheers = cheers
    m.epoch = epoch
    if (!m.moving) m.lastFrame = now
    m.moving = true
    invalidate()
  }, [avatarStop, cheers, epoch, reducedMotion, invalidate])

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

    m.heading = turnToward(m.heading, aim, elapsed)
    pose(rig, m, lift, hop)

    // The canvas only draws on demand, so ask for another frame while anything is moving.
    m.moving = m.trip !== null || m.cheerStart !== null || m.cheerQueued || m.heading !== aim
    if (m.moving) invalidate()
  })

  return <Body rig={rig} />
}
