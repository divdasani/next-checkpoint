import { useRef, useState } from 'react'
import { Color, type Group, type Mesh } from 'three'
import { useGame } from '../state/GameContext.tsx'
import { isMissionComplete } from '../state/selectors.ts'
import { ZoneShell } from './ZoneShell.tsx'
import { Block, HitTarget, easing, useOwnMaterial, usePulse, useTween } from './kit.tsx'
import { MISSION_COLOR, NETWORK_KIT, PALETTE, ZONES, type Vec3 } from './layout.ts'

// Mission one, "Eight Worlds, One System".
// Eight identical company blocks stand around a hub tower. Each one already has a dim
// connector on the floor: a strip from the hub that ends in a square pad under the block.
// Clicking a block sends CONNECT_COMPANY to the reducer. This file only draws the state:
//   state.network.connected[i]  -> connector i turns blue and thicker, block i rises with
//                                  its pad, and a blue cap pops out of its roof
//   all eight connected         -> the beacon on top of the hub lights and stays lit
// To restyle the zone, change the sizes and colors below. Positions come from layout.ts.

const FLOOR = ZONES.network.floorY
const BLUE = MISSION_COLOR.network

// Connector sizes, as [before, after] the company is connected.
const LINK_WIDTH = [0.14, 0.26] as const
const LINK_HEIGHT = [0.04, 0.12] as const
/** Where the strip starts, measured from the hub center. That is inside the hub base, so it looks plugged in. */
const LINK_START = 0.3
const PAD_WIDTH = 0.72
/** The pad stands a hair above the strip, so their top faces never sit at the same height. */
const PAD_EXTRA = 0.012

// Company block: a plain body and roof. The blue cap waits inside until the company connects.
const BODY: Vec3 = [0.56, 0.4, 0.56]
const ROOF: Vec3 = [0.64, 0.08, 0.64]
const CAP: Vec3 = [0.44, 0.18, 0.44]
const BLOCK_BASE = FLOOR + LINK_HEIGHT[0]
const ROOF_TOP = BLOCK_BASE + BODY[1] + ROOF[1]
const CAP_HIDDEN_Y = ROOF_TOP - 0.02 - CAP[1] / 2
const CAP_RISE = 0.16
const HOVER_LIFT = 0.1

// Click target: wide so it is easy to tap, and low on purpose. A taller box would sit in
// front of the blocks behind it on screen, and a click on one company would connect its neighbor.
const TARGET: Vec3 = [1.2, 0.4, 1.2]

// Hub tower, listed bottom to top. Each tier stands on the one before it. The mast is thin
// and dark on purpose: Company A stands directly behind the hub on screen and must stay readable.
const HUB_TIERS = [
  { name: 'base', width: 1.04, height: 0.18, color: PALETTE.ink, shape: 'cylinder' },
  { name: 'station', width: 0.6, height: 0.74, color: PALETTE.cream, shape: 'box' },
  { name: 'eave', width: 0.7, height: 0.1, color: BLUE, shape: 'box' },
  { name: 'roof', width: 0.44, height: 0.18, color: BLUE, shape: 'box' },
  { name: 'mast', width: 0.16, height: 1.16, color: PALETTE.ink, shape: 'box' },
] as const
// The lamp on top of the mast: a dark deck, and a beacon that is smaller until it is lit.
const DECK: Vec3 = [0.5, 0.08, 0.5]
const BEACON_SIZE = 0.42
const BEACON_UNLIT_SCALE = 0.74
/** How strongly the lit beacon shines by itself, so even its shaded sides look bright. */
const BEACON_GLOW = 0.35

/** Work out the height of each tier's center, and where the stack ends (the lamp stands there). */
function stackTiers() {
  let top = FLOOR
  const tiers = HUB_TIERS.map((tier) => {
    top += tier.height
    return { ...tier, y: top - tier.height / 2 }
  })
  return { tiers, top }
}
const HUB_STACK = stackTiers()
const BEACON_BASE_Y = HUB_STACK.top + DECK[1]

const COLOR_OFF = new Color(PALETTE.off)
const COLOR_LIVE = new Color(BLUE)
const COLOR_GLOW = new Color(PALETTE.glow)

const mix = (from: number, to: number, t: number) => from + (to - from) * t

/** The tower in the middle. Its beacon is the only part that changes. */
function Hub({ lit }: { lit: boolean }) {
  const [x, , z] = NETWORK_KIT.hub
  const beacon = useRef<Mesh>(null)
  const material = useOwnMaterial(PALETTE.off, PALETTE.glow)
  // The tween (lit or not) and the pulse both resize the beacon, so they share one pose.
  const pose = useRef({ lit: 0, pulse: 1 })

  const placeBeacon = () => {
    const mesh = beacon.current
    if (!mesh) return
    const { lit: amount, pulse } = pose.current
    const size = BEACON_SIZE * mix(BEACON_UNLIT_SCALE, 1, amount) * (1 + 0.22 * Math.sin(Math.PI * pulse))
    mesh.scale.setScalar(size)
    // Keep the beacon standing on its deck while it grows.
    mesh.position.y = BEACON_BASE_Y + size / 2
  }

  // Lit: the beacon changes color, glows on every side, and grows. It stays that way.
  useTween(
    lit ? 1 : 0,
    (value) => {
      pose.current.lit = value
      material.color.lerpColors(COLOR_OFF, COLOR_GLOW, value)
      material.emissiveIntensity = BEACON_GLOW * value
      placeBeacon()
    },
    { duration: 420 },
  )

  // One short swell at the moment the network is completed.
  usePulse(
    lit,
    (progress) => {
      pose.current.pulse = progress
      placeBeacon()
    },
    520,
  )

  return (
    <>
      {HUB_STACK.tiers.map((tier) => (
        <Block
          key={tier.name}
          at={[x, tier.y, z]}
          size={[tier.width, tier.height, tier.width]}
          color={tier.color}
          shape={tier.shape}
        />
      ))}
      {/* The lamp casts no shadow. From this height it would land as a smudge on Company C. */}
      <Block at={[x, HUB_STACK.top + DECK[1] / 2, z]} size={DECK} color={PALETTE.ink} cast={false} />
      <Block
        ref={beacon}
        at={[x, BEACON_BASE_Y + BEACON_SIZE / 2, z]}
        size={[BEACON_SIZE, BEACON_SIZE, BEACON_SIZE]}
        material={material}
        cast={false}
      />
    </>
  )
}

interface CompanyProps {
  at: Vec3
  connected: boolean
  /** True while this mission is selected and not yet complete. */
  playing: boolean
  onConnect: () => void
}

/** One company: its floor connector, its block, and its click target. */
function Company({ at, connected, playing, onConnect }: CompanyProps) {
  const [x, , z] = at
  const [hx, , hz] = NETWORK_KIT.hub
  // The strip runs from just inside the hub base to the middle of the pad.
  const dx = x - hx
  const dz = z - hz
  const reach = Math.hypot(dx, dz)
  const stripLength = reach - LINK_START
  const stripMiddle = (LINK_START + stripLength / 2) / reach

  // Hover is plain React state: it changes once per pointer move, not once per frame.
  const [hovered, setHovered] = useState(false)
  const strip = useRef<Mesh>(null)
  const pad = useRef<Mesh>(null)
  const cap = useRef<Mesh>(null)
  const raise = useRef<Group>(null)
  const lift = useRef<Group>(null)
  // The strip and pad share one material of their own, because their color animates.
  const linkMaterial = useOwnMaterial(PALETTE.off)

  // Connected: the connector turns blue and thickens, the block rises with its pad, and the
  // cap pops out of the roof. Every color change comes with a shape change.
  useTween(
    connected ? 1 : 0,
    (value) => {
      linkMaterial.color.lerpColors(COLOR_OFF, COLOR_LIVE, Math.min(1, value))
      const height = mix(LINK_HEIGHT[0], LINK_HEIGHT[1], value)
      if (strip.current) {
        strip.current.scale.set(mix(LINK_WIDTH[0], LINK_WIDTH[1], value), height, stripLength)
        strip.current.position.y = FLOOR + height / 2
      }
      if (pad.current) {
        pad.current.scale.y = height + PAD_EXTRA
        pad.current.position.y = FLOOR + (height + PAD_EXTRA) / 2
      }
      if (raise.current) raise.current.position.y = height - LINK_HEIGHT[0]
      if (cap.current) {
        cap.current.visible = value > 0.01
        cap.current.position.y = CAP_HIDDEN_Y + CAP_RISE * value
      }
    },
    { duration: 320, easing: easing.outBack },
  )

  // A block that can still be connected rises slightly under the pointer.
  useTween(
    hovered && playing && !connected ? 1 : 0,
    (value) => {
      if (lift.current) lift.current.position.y = HOVER_LIFT * value
    },
    { duration: 140 },
  )

  return (
    <>
      {/* The strip's length runs along its own z axis, so it is turned to point at the company. */}
      <Block
        ref={strip}
        at={[hx + dx * stripMiddle, FLOOR + LINK_HEIGHT[0] / 2, hz + dz * stripMiddle]}
        size={[LINK_WIDTH[0], LINK_HEIGHT[0], stripLength]}
        rotation={[0, Math.atan2(dx, dz), 0]}
        material={linkMaterial}
        cast={false}
      />
      <Block
        ref={pad}
        at={[x, FLOOR + (LINK_HEIGHT[0] + PAD_EXTRA) / 2, z]}
        size={[PAD_WIDTH, LINK_HEIGHT[0] + PAD_EXTRA, PAD_WIDTH]}
        material={linkMaterial}
        cast={false}
      />
      {/* Outer group: raised when connected. Inner group: lifted on hover. */}
      <group ref={raise}>
        <group ref={lift}>
          <Block at={[x, BLOCK_BASE + BODY[1] / 2, z]} size={BODY} color={PALETTE.stone} />
          <Block at={[x, ROOF_TOP - ROOF[1] / 2, z]} size={ROOF} color={PALETTE.stone} />
          <Block ref={cap} at={[x, CAP_HIDDEN_Y, z]} size={CAP} color={BLUE} />
        </group>
      </group>
      {/* A connected company keeps its target: the reducer ignores the repeat click, and the
          target stops that click from passing through to a block behind. */}
      <HitTarget
        enabled={playing}
        at={[x, FLOOR + TARGET[1] / 2, z]}
        size={TARGET}
        onActivate={onConnect}
        onHoverChange={setHovered}
      />
    </>
  )
}

export function NetworkZone() {
  const { state, dispatch } = useGame()
  const complete = isMissionComplete(state, 'network')
  const playing = state.activeMission === 'network' && !complete

  return (
    <ZoneShell id="network">
      <Hub lit={complete} />
      {NETWORK_KIT.companies.map((at, index) => (
        <Company
          key={index}
          at={at}
          connected={state.network.connected[index]}
          playing={playing}
          onConnect={() => dispatch({ type: 'CONNECT_COMPANY', index })}
        />
      ))}
    </ZoneShell>
  )
}
