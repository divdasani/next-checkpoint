import { useMemo, useRef } from 'react'
import { Color, type Group, type Mesh } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { missingSources } from '../state/selectors.ts'
import { SOURCE_IDS, type SourceId } from '../state/types.ts'
import { ZoneShell } from './ZoneShell.tsx'
import { Block, HitTarget, easing, useOwnMaterial, usePulse, useTween } from './kit.tsx'
import { MISSION_COLOR, PALETTE, SIGNAL_KIT, ZONES, type Vec3 } from './layout.ts'

// Mission two, "Find the Signal".
// Three data sources stand in the front of the zone. Each is a pedestal with a small lamp and
// one gray bar lying crooked on top. At the back is the dashboard console: a wide screen, a
// deck with three sockets, and the feed switch. Clicking a source sends ACTIVATE_SOURCE and
// clicking the switch sends START_FEED to the reducer. This file only draws the state:
//   state.signal.sources[id]  -> that bar takes its color, stands up and grows to its height,
//                                and its lamp lights in the same color and gets taller
//   all three sources on      -> the feed switch turns bright yellow and stands taller
//   state.signal.feedOn       -> the switch stays pressed, the floor line lights, the bars hop
//                                to the deck and line up on one baseline, and the screen lights
//   state.hint (signal)       -> a yellow frame marks the source to switch on next

const FLOOR = ZONES.signal.floorY
const YELLOW = MISSION_COLOR.signal

// Console: a deck on the floor and, along its back edge, the screen panel with a small antenna.
// The screen faces +z and the bars line up on the deck in front of it.
const [SCREEN_X, , SCREEN_Z] = SIGNAL_KIT.screen
const [SCREEN_W, SCREEN_H] = SIGNAL_KIT.screenSize
const SLOTS = SIGNAL_KIT.slots
const DECK_TOP = SLOTS.revenue[1]
/** Deck edges: left and right are x, back and front are z. It reaches further on the left to carry the switch. */
const DECK = {
  left: SCREEN_X - SCREEN_W / 2 - 0.45,
  right: SCREEN_X + SCREEN_W / 2 + 0.1,
  back: SCREEN_Z - 0.23,
  front: SLOTS.revenue[2] + 0.35,
}
const DECK_AT: Vec3 = [(DECK.left + DECK.right) / 2, (FLOOR + DECK_TOP) / 2, (DECK.back + DECK.front) / 2]
const DECK_SIZE: Vec3 = [DECK.right - DECK.left, DECK_TOP - FLOOR, DECK.front - DECK.back]
const SOCKET: Vec3 = [0.5, 0.02, 0.5]
const PANEL: Vec3 = [SCREEN_W, SCREEN_H, 0.3]
const PANEL_AT: Vec3 = [SCREEN_X, DECK_TOP + SCREEN_H / 2, SCREEN_Z]
const PANEL_TOP = DECK_TOP + SCREEN_H
/** The lit face is a little smaller than the panel, so the yellow shows as a frame around it. */
const SCREEN: Vec3 = [SCREEN_W - 0.28, SCREEN_H - 0.28, 0.06]
const SCREEN_AT: Vec3 = [SCREEN_X, PANEL_AT[1], SCREEN_Z + PANEL[2] / 2]
const MAST: Vec3 = [0.08, 0.5, 0.08]
const TIP: Vec3 = [0.2, 0.2, 0.2]
/** The antenna tip rests on the panel and ends at the top of the mast, as [unlit, lit] heights. */
const TIP_Y = [PANEL_TOP + TIP[1] / 2, PANEL_TOP + MAST[1]] as const

// Sources: a pedestal on a dark base, a lamp on its front corner, and one bar.
const PEDESTAL = 0.72
const BASE: Vec3 = [0.84, 0.06, 0.84]
const HINT_FRAME: Vec3 = [1.16, 0.04, 1.16]
/** The lamp while it is off: a flat tile. Lit, it stands LAMP_LIT tall. */
const LAMP: Vec3 = [0.18, 0.05, 0.18]
const LAMP_LIT = 0.2
/** The lamp sits flush in the corner of the pedestal that faces the camera. */
const LAMP_OFFSET = (PEDESTAL - LAMP[0]) / 2
const BAR_WIDTH = 0.36
/** Every bar is this long while it lies switched off. It grows to its own height when it stands. */
const LYING_LENGTH = 0.6
/** How high a bar hops on its way to the deck. */
const HOP = 0.55
/**
 * Invisible click boxes around each source and around the switch. They are wide, so they are
 * easy to tap, and low, so the camera's line of sight to the source behind passes over them
 * and a click lands on the source under the pointer.
 */
const SOURCE_TARGET: Vec3 = [0.9, 0.5, 0.9]
const SWITCH_TARGET: Vec3 = [1.0, 0.5, 1.0]

// One row per source:
//   at        where the pedestal stands on the floor, as [x, z], from SIGNAL_KIT.sources. They are
//             placed so that a standing bar does not hide another source or the switch
//   pedestal  its height. They differ on purpose, so the bars start on three different baselines
//   bar       the bar's height once it stands
//   askew     how far the bar is turned while it lies on the pedestal, in radians
//   delay     milliseconds the bar waits before it leaves for the deck, so they go one by one
const floorSpot = (id: SourceId) => [SIGNAL_KIT.sources[id][0], SIGNAL_KIT.sources[id][2]] as const
const SOURCES = {
  revenue: { at: floorSpot('revenue'), pedestal: 0.44, bar: 0.6, askew: -0.4, color: PALETTE.green, delay: 0 },
  invoices: { at: floorSpot('invoices'), pedestal: 0.34, bar: 0.9, askew: -1.15, color: PALETTE.blue, delay: 130 },
  inquiries: { at: floorSpot('inquiries'), pedestal: 0.24, bar: 1.2, askew: -0.8, color: PALETTE.coral, delay: 260 },
} as const satisfies Record<SourceId, object>

// Feed switch: a round button whose height is the state cue. It stands on the left end of the
// deck, in line with the sockets.
const SWITCH_AT: Vec3 = [DECK.left + 0.36, DECK_TOP, SLOTS.revenue[2]]
const PLINTH: Vec3 = [0.64, 0.08, 0.64]
const CAP_HEIGHT = { waiting: 0.1, ready: 0.3, pressed: 0.04 } as const
const CAP: Vec3 = [0.5, CAP_HEIGHT.waiting, 0.5]

// Feed line: thin strips on the floor, as [x0, z0, x1, z1]. A trunk runs from the first source
// to the deck, a rail crosses the zone, and the other two sources each join the rail.
const LINE_WIDTH = 0.12
const LINE_HEIGHT = [0.03, 0.08] as const
const RAIL_Z = -4.9
const LINES = [
  [SOURCES.revenue.at[0], SOURCES.revenue.at[1], SOURCES.revenue.at[0], DECK.front],
  [SOURCES.revenue.at[0], RAIL_Z, SOURCES.inquiries.at[0], RAIL_Z],
  [SOURCES.invoices.at[0], SOURCES.invoices.at[1], SOURCES.invoices.at[0], RAIL_Z],
  [SOURCES.inquiries.at[0], SOURCES.inquiries.at[1], SOURCES.inquiries.at[0], RAIL_Z],
] as const

const COLOR_OFF = new Color(PALETTE.off)
const COLOR_LAMP_OFF = new Color(PALETTE.offDark)
const COLOR_SCREEN_OFF = new Color(PALETTE.screenOff)
const COLOR_SCREEN_ON = new Color(PALETTE.screenOn)
const COLOR_YELLOW = new Color(YELLOW)
/** A washed yellow for the switch while a source is still missing. */
const COLOR_WAITING = new Color(PALETTE.off).lerp(COLOR_YELLOW, 0.35)
const COLOR_LINE_OFF = new Color(PALETTE.pathEdge)

const mix = (from: number, to: number, t: number) => from + (to - from) * t

/** The dashboard: a cream deck with three sockets, a yellow-framed screen, and a small antenna. */
function Console({ lit }: { lit: boolean }) {
  const tip = useRef<Mesh>(null)
  // The screen and the antenna tip share one material, so they light together.
  const light = useOwnMaterial(PALETTE.screenOff, PALETTE.screenOn)

  // Feed running: the screen turns from dark to bright (color) and the antenna tip slides up
  // its mast (shape). It waits a moment so the bars arrive first.
  useTween(
    lit ? 1 : 0,
    (value) => {
      light.color.lerpColors(COLOR_SCREEN_OFF, COLOR_SCREEN_ON, value)
      light.emissiveIntensity = 0.38 * value
      if (tip.current) tip.current.position.y = mix(TIP_Y[0], TIP_Y[1], value)
    },
    { duration: 500, delay: 450 },
  )

  return (
    <>
      <Block at={DECK_AT} size={DECK_SIZE} color={PALETTE.cream} />
      {SOURCE_IDS.map((id) => {
        const [x, , z] = SLOTS[id]
        return <Block key={id} at={[x, DECK_TOP + 0.01, z]} size={SOCKET} color={PALETTE.ink} cast={false} />
      })}
      <Block at={PANEL_AT} size={PANEL} color={YELLOW} />
      <Block at={[SCREEN_X, PANEL_TOP + MAST[1] / 2, SCREEN_Z]} size={MAST} color={PALETTE.ink} cast={false} />
      {/* No shadows on the two lights: a light source should not look shaded. */}
      <Block at={SCREEN_AT} size={SCREEN} material={light} cast={false} receive={false} />
      <Block ref={tip} at={[SCREEN_X, TIP_Y[0], SCREEN_Z]} size={TIP} material={light} cast={false} receive={false} />
    </>
  )
}

/** Thin strips on the floor that join the sources to the console. They light with the feed. */
function FeedLine({ live }: { live: boolean }) {
  const strips = useRef<Group>(null)
  const material = useOwnMaterial(PALETTE.pathEdge)

  // Feed running: the strips turn yellow (color) and stand taller (shape).
  useTween(
    live ? 1 : 0,
    (value) => {
      material.color.lerpColors(COLOR_LINE_OFF, COLOR_YELLOW, value)
      if (strips.current) strips.current.scale.y = mix(LINE_HEIGHT[0], LINE_HEIGHT[1], value)
    },
    { duration: 300 },
  )

  // Every strip is one unit tall inside the group, so the group's height is the strips' height.
  return (
    <group ref={strips} position={[0, FLOOR, 0]}>
      {LINES.map(([x0, z0, x1, z1], index) => (
        <Block
          key={index}
          at={[(x0 + x1) / 2, 0.5, (z0 + z1) / 2]}
          size={[Math.abs(x1 - x0) + LINE_WIDTH, 1, Math.abs(z1 - z0) + LINE_WIDTH]}
          material={material}
          cast={false}
        />
      ))}
    </group>
  )
}

interface SourceProps {
  id: SourceId
  on: boolean
  /** The feed is running, so this bar belongs on the deck. */
  feeding: boolean
  /** The reducer named this source as the next one to switch on. */
  hinted: boolean
  clickable: boolean
  onActivate: () => void
}

/** One data source: base, pedestal, lamp, bar, and click target. */
function Source({ id, on, feeding, hinted, clickable, onActivate }: SourceProps) {
  const spec = SOURCES[id]
  const [x, z] = spec.at
  const slot = SLOTS[id]
  const top = FLOOR + spec.pedestal
  const lampAt: Vec3 = [x + LAMP_OFFSET, top + LAMP[1] / 2, z + LAMP_OFFSET]
  const bar = useRef<Group>(null)
  const lamp = useRef<Mesh>(null)
  const barMaterial = useOwnMaterial(PALETTE.off)
  const lampMaterial = useOwnMaterial(PALETTE.offDark, spec.color)
  const liveColor = useMemo(() => new Color(spec.color), [spec.color])
  // Standing up and travelling both move the bar, so they share one pose:
  // "up" goes from 0 (lying) to 1 (standing), "go" from 0 (on the pedestal) to 1 (on the deck).
  const pose = useRef({ up: 0, go: 0 })

  const placeBar = () => {
    const group = bar.current
    if (!group) return
    const { up, go } = pose.current
    const length = mix(LYING_LENGTH, spec.bar, up)
    const tilt = (1 - up) * (Math.PI / 2)
    // Distance from the bar's middle down to whatever it rests on, for any tilt.
    const rest = (Math.abs(Math.cos(tilt)) * length + Math.abs(Math.sin(tilt)) * BAR_WIDTH) / 2
    const y = mix(top, slot[1], go) + rest + HOP * Math.sin(Math.PI * go)
    group.scale.y = length
    // 'YXZ' applies the tilt first and the turn second, so a lying bar turns flat on its pedestal.
    group.rotation.set(tilt, (1 - up) * spec.askew, 0, 'YXZ')
    group.position.set(mix(x, slot[0], go), y, mix(z, slot[2], go))
  }

  // Source on: the bar takes its color, stands up and grows, and the lamp lights and gets taller.
  useTween(
    on ? 1 : 0,
    (value) => {
      pose.current.up = value
      placeBar()
      barMaterial.color.lerpColors(COLOR_OFF, liveColor, Math.min(1, value))
      lampMaterial.color.lerpColors(COLOR_LAMP_OFF, liveColor, Math.min(1, value))
      lampMaterial.emissiveIntensity = 0.35 * value
      if (lamp.current) {
        lamp.current.scale.y = mix(LAMP[1], LAMP_LIT, value)
        lamp.current.position.y = top + lamp.current.scale.y / 2
      }
    },
    { duration: 420, easing: easing.outBack },
  )

  // Feed running: the bar hops from its pedestal to its socket on the deck.
  useTween(
    feeding ? 1 : 0,
    (value) => {
      pose.current.go = value
      placeBar()
    },
    { duration: 600, delay: spec.delay, easing: easing.inOutCubic },
  )

  return (
    <>
      {hinted && <Block at={[x, FLOOR + HINT_FRAME[1] / 2, z]} size={HINT_FRAME} color={YELLOW} cast={false} />}
      <Block at={[x, FLOOR + BASE[1] / 2, z]} size={BASE} color={PALETTE.ink} cast={false} />
      <Block at={[x, FLOOR + spec.pedestal / 2, z]} size={[PEDESTAL, spec.pedestal, PEDESTAL]} color={PALETTE.cream} />
      <Block ref={lamp} at={lampAt} size={LAMP} material={lampMaterial} cast={false} />
      {/* The bar is a box one unit tall inside a group, so the group can turn, stretch, and move it. */}
      <group ref={bar}>
        <Block at={[0, 0, 0]} size={[BAR_WIDTH, 1, BAR_WIDTH]} material={barMaterial} />
      </group>
      <HitTarget
        enabled={clickable}
        at={[x, FLOOR + SOURCE_TARGET[1] / 2, z]}
        size={SOURCE_TARGET}
        onActivate={onActivate}
      />
      {/* A standing bar is taller than the low target. This second box catches clicks on the
          bar itself, so they repeat this source (which changes nothing) instead of falling
          through to a source behind it. */}
      <HitTarget
        enabled={clickable && on}
        at={[x, top + spec.bar / 2, z]}
        size={[BAR_WIDTH + 0.1, spec.bar, BAR_WIDTH + 0.1]}
        onActivate={onActivate}
      />
    </>
  )
}

interface FeedSwitchProps {
  ready: boolean
  running: boolean
  /** Counts presses that came too early, so each one gets a small "not yet" dip. */
  refusals: number
  clickable: boolean
  onPress: () => void
}

/** The feed switch: a dark plinth and a round cap that shows its three states by height. */
function FeedSwitch({ ready, running, refusals, clickable, onPress }: FeedSwitchProps) {
  const [x, y, z] = SWITCH_AT
  const cap = useRef<Mesh>(null)
  const dip = useRef<Group>(null)
  const material = useOwnMaterial(PALETTE.off)

  // Waiting is low, ready stands tall, running stays pressed in.
  useTween(
    running ? CAP_HEIGHT.pressed : ready ? CAP_HEIGHT.ready : CAP_HEIGHT.waiting,
    (value) => {
      if (!cap.current) return
      cap.current.scale.y = Math.max(0.02, value)
      cap.current.position.y = cap.current.scale.y / 2
    },
    { duration: 260, easing: easing.outBack },
  )

  useTween(ready ? 1 : 0, (value) => material.color.lerpColors(COLOR_WAITING, COLOR_YELLOW, value), { duration: 260 })

  // Pressed too early: the cap dips once. The HTML panel explains what is missing.
  usePulse(
    refusals,
    (progress) => {
      if (dip.current) dip.current.scale.y = refusals > 0 ? 1 - 0.5 * Math.sin(Math.PI * progress) : 1
    },
    240,
  )

  return (
    <>
      <Block at={[x, y + PLINTH[1] / 2, z]} size={PLINTH} color={PALETTE.ink} cast={false} shape="cylinder" />
      <group ref={dip} position={[x, y + PLINTH[1], z]}>
        <Block ref={cap} at={[0, CAP[1] / 2, 0]} size={CAP} material={material} shape="cylinder" />
      </group>
      <HitTarget
        enabled={clickable}
        at={[x + 0.1, y + SWITCH_TARGET[1] / 2, z]}
        size={SWITCH_TARGET}
        onActivate={onPress}
      />
    </>
  )
}

export function SignalZone() {
  const { state, dispatch } = useGame()
  const { sources, feedOn } = state.signal
  // The 3D click targets only exist while this mission is selected and not yet complete.
  const playing = state.activeMission === 'signal' && !feedOn
  const hint = state.hint?.mission === 'signal' ? state.hint : null

  return (
    <ZoneShell id="signal">
      <Console lit={feedOn} />
      <FeedLine live={feedOn} />
      {SOURCE_IDS.map((id) => (
        <Source
          key={id}
          id={id}
          on={sources[id]}
          feeding={feedOn}
          hinted={hint?.next === id}
          // A source that is already on keeps its target: the repeat click changes nothing,
          // and it cannot fall through to a source standing behind it.
          clickable={playing}
          onActivate={() => dispatch({ type: 'ACTIVATE_SOURCE', source: id })}
        />
      ))}
      <FeedSwitch
        ready={missingSources(state).length === 0}
        running={feedOn}
        refusals={hint?.attempts ?? 0}
        clickable={playing}
        onPress={() => dispatch({ type: 'START_FEED' })}
      />
    </ZoneShell>
  )
}
