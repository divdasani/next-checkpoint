import type { MissionId, ReadinessId, SourceId, StopId } from '../state/types.ts'

// ─────────────────────────────────────────────────────────────────────────────
// The whole world as fixed data. Nothing here is random or generated at runtime
// beyond simple loops, so the island looks identical on every visit.
//
// Axes: +y is up. The camera looks from (+x, +y, +z), so on screen
//   back/top    = (-x, -z)      front/bottom = (+x, +z)
//   left        = (-x, +z)      right        = (+x, -z)
// One unit is one path tile.
// ─────────────────────────────────────────────────────────────────────────────

export type Vec3 = readonly [x: number, y: number, z: number]

export const PALETTE = {
  // Terrain
  grass: '#66cf6f',
  grassLight: '#82de81',
  earth: '#f1c9a5',
  earthMid: '#e2b48c',
  earthDark: '#cf9d77',
  earthDeep: '#b98862',
  sand: '#f8e6b8',
  path: '#fbe9bd',
  pathEdge: '#e9d19a',
  water: '#84d6f7',
  // Neutrals
  white: '#ffffff',
  cream: '#fff5e6',
  stone: '#ecebe6',
  stoneDark: '#b7bcc6',
  off: '#c5cad3',
  offDark: '#98a0ad',
  ink: '#1b2a4a',
  // Nature
  trunk: '#9a6a49',
  leaf: '#3faf5c',
  leafLight: '#5cc76d',
  rock: '#aab1bd',
  cloud: '#ffffff',
  // Accents (kept in step with the CSS tokens in styles/tokens.css)
  blue: '#2f86f6',
  yellow: '#ffc233',
  coral: '#ff6b5c',
  teal: '#18b8a6',
  green: '#3ec46d',
  // Zone floors
  plazaBlue: '#dde9f7',
  plazaYellow: '#fff0c4',
  plazaCoral: '#ffd6cb',
  plazaCoralTop: '#ffe7df',
  // Screens and lights
  screenOff: '#2a3757',
  screenOn: '#f3fbff',
  glow: '#fff2ae',
} as const

export type PaletteKey = keyof typeof PALETTE

export const MISSION_COLOR: Record<MissionId, string> = {
  network: PALETTE.blue,
  signal: PALETTE.yellow,
  launch: PALETTE.coral,
}

// ── Island proportions ───────────────────────────────────────────────────────

/** Half-width of the square island. */
export const ISLAND_HALF = 7.2
/** The road is a square ring; its corners are the four avatar stops. */
export const RING = 2.5
/** Each corner zone spans ZONE_MIN..ZONE_MAX on both axes (with signs per corner). */
export const ZONE_MIN = 3.1
export const ZONE_MAX = 6.9

// ── Avatar stops and the road between them ───────────────────────────────────

export const STOPS: Record<StopId, Vec3> = {
  home: [RING, 0, RING],
  network: [-RING, 0, RING],
  launch: [-RING, 0, -RING],
  signal: [RING, 0, -RING],
}

/** Height of the top of a checkpoint pad. The avatar's feet rest here. */
export const PAD_TOP = 0.125

/** Stops in order around the ring road. Neighbors in this list are joined by a straight road. */
export const RING_ORDER: readonly StopId[] = ['home', 'network', 'launch', 'signal']

// ── Mission zones ────────────────────────────────────────────────────────────

export interface ZoneSpec {
  id: MissionId
  /** Zone center on its floor. */
  center: Vec3
  /** Ground rectangle as [minX, minZ, maxX, maxZ]. */
  bounds: readonly [number, number, number, number]
  /** Height of the floor the mission objects stand on. */
  floorY: number
  /** Height of the tallest object, used for camera framing. */
  topY: number
  /** Where the HTML destination label is pinned (just above the main building). */
  pin: Vec3
}

export const ZONES: Record<MissionId, ZoneSpec> = {
  network: {
    id: 'network',
    center: [-5, 0.12, 5],
    bounds: [-ZONE_MAX, ZONE_MIN, -ZONE_MIN, ZONE_MAX],
    floorY: 0.12,
    topY: 3.1,
    pin: [-5, 3.45, 5],
  },
  signal: {
    id: 'signal',
    center: [5, 0.12, -5],
    bounds: [ZONE_MIN, -ZONE_MAX, ZONE_MAX, -ZONE_MIN],
    floorY: 0.12,
    topY: 2.6,
    pin: [5, 2.95, -6.25],
  },
  launch: {
    id: 'launch',
    center: [-5, 0.5, -5],
    bounds: [-ZONE_MAX, -ZONE_MAX, -ZONE_MIN, -ZONE_MIN],
    floorY: 0.5,
    topY: 3.6,
    pin: [-5.3, 3.95, -6.05],
  },
}

// ── Mission kits: where each mission's objects stand ─────────────────────────

const HUB: Vec3 = [-5, 0.12, 5]
const COMPANY_SPACING = 1.35
/** Offsets around the hub, clockwise as seen on screen, starting at the back corner. */
const COMPANY_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
]

export const NETWORK_KIT = {
  hub: HUB,
  /** Eight company block positions (index 0..7 = Company A..H). */
  companies: COMPANY_OFFSETS.map(
    ([dx, dz]): Vec3 => [HUB[0] + dx * COMPANY_SPACING, HUB[1], HUB[2] + dz * COMPANY_SPACING],
  ),
} as const

export const SIGNAL_KIT = {
  /** Dashboard screen: bottom center of the panel. It faces +z. */
  screen: [5, 0.12, -6.25] as Vec3,
  screenSize: [2.7, 1.55] as readonly [width: number, height: number],
  /** Where the three bars line up once the feed is running (left to right on the deck). */
  slots: {
    revenue: [4.2, 0.32, -5.65],
    invoices: [5.0, 0.32, -5.65],
    inquiries: [5.8, 0.32, -5.65],
  } as Record<SourceId, Vec3>,
  /** Source pedestals at the front of the zone: where each one stands on the floor. */
  sources: {
    revenue: [3.75, 0.12, -4.15],
    invoices: [5.12, 0.12, -3.8],
    inquiries: [6.2, 0.12, -4.02],
  } as Record<SourceId, Vec3>,
} as const

export const LAUNCH_KIT = {
  /** Arch: bottom center. The opening faces +z. */
  arch: [-5.3, 0.5, -6.05] as Vec3,
  archSize: [2.8, 2.9] as readonly [width: number, height: number],
  /**
   * Three readiness posts in a row in front of the left pillar. The first check is nearest
   * the camera, so they read left to right on screen in the same order as the HTML panel.
   */
  posts: {
    requirements: [-6.4, 0.5, -4.05],
    uat: [-6.4, 0.5, -4.72],
    comms: [-6.4, 0.5, -5.39],
  } as Record<ReadinessId, Vec3>,
  /** The launch button, centered on the doorway. */
  button: [-5.3, 0.5, -4.55] as Vec3,
} as const

// ── Static terrain ───────────────────────────────────────────────────────────

export interface BlockSpec {
  id: string
  /** Center of the box. */
  at: Vec3
  size: Vec3
  color: PaletteKey
  /** Small or decorative boxes can skip shadows. */
  cast?: boolean
  receive?: boolean
}

/** Build a box from its bounds, which is easier to reason about for terrain. */
function slab(
  id: string,
  color: PaletteKey,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  extra: Partial<BlockSpec> = {},
): BlockSpec {
  return {
    id,
    color,
    at: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    size: [x1 - x0, y1 - y0, z1 - z0],
    ...extra,
  }
}

const H = ISLAND_HALF
const Z0 = ZONE_MIN
const Z1 = ZONE_MAX

function roadTiles(): BlockSpec[] {
  const tiles: BlockSpec[] = []
  const offsets = [-1.5, -0.5, 0.5, 1.5]
  for (const o of offsets) {
    tiles.push(slab(`road-front-left-${o}`, 'path', o - 0.45, o + 0.45, RING - 0.45, RING + 0.45, 0, 0.06))
    tiles.push(slab(`road-back-right-${o}`, 'path', o - 0.45, o + 0.45, -RING - 0.45, -RING + 0.45, 0, 0.06))
    tiles.push(slab(`road-back-left-${o}`, 'path', -RING - 0.45, -RING + 0.45, o - 0.45, o + 0.45, 0, 0.06))
    tiles.push(slab(`road-front-right-${o}`, 'path', RING - 0.45, RING + 0.45, o - 0.45, o + 0.45, 0, 0.06))
  }
  return tiles.map((tile) => ({ ...tile, cast: false }))
}

export const TERRAIN: readonly BlockSpec[] = [
  // Stepped underside, so the island reads as floating.
  slab('under-3', 'earthDeep', -5.4, 5.4, -5.4, 5.4, -3.9, -3.0, { receive: false }),
  slab('under-2', 'earthDark', -6.0, 6.0, -6.0, 6.0, -3.0, -2.1, { receive: false }),
  slab('under-1', 'earthMid', -6.6, 6.6, -6.6, 6.6, -2.1, -1.2, { receive: false }),
  // Main body and grass cap. The front corner is left open as a lower sand terrace.
  slab('body', 'earth', -H, H, -H, H, -1.2, -0.3),
  slab('grass-back', 'grass', -H, H, -H, Z0, -0.3, 0),
  slab('grass-left', 'grass', -H, Z0, Z0, H, -0.3, 0),
  slab('sand-terrace', 'sand', Z0, H, Z0, H, -0.3, -0.22, { cast: false }),
  // Zone floors.
  slab('plaza-network', 'plazaBlue', -Z1, -Z0, Z0, Z1, 0, 0.12, { cast: false }),
  slab('plaza-signal', 'plazaYellow', Z0, Z1, -Z1, -Z0, 0, 0.12, { cast: false }),
  slab('plaza-launch-1', 'plazaCoral', -Z1, -Z0, -Z1, -Z0, 0, 0.25),
  slab('plaza-launch-2', 'plazaCoralTop', -Z1, -3.7, -Z1, -3.7, 0.25, 0.5),
  // Two low hills on the back sides.
  slab('hill-left-1', 'grassLight', -6.7, -3.7, -2.2, 2.0, 0, 0.3),
  slab('hill-left-2', 'grass', -6.5, -4.7, -1.8, 0.3, 0.3, 0.6),
  slab('hill-right-1', 'grassLight', -2.0, 2.2, -6.7, -3.7, 0, 0.3),
  slab('hill-right-2', 'grass', -0.3, 1.8, -6.5, -4.7, 0.3, 0.6),
  // Pond inside the ring road.
  slab('pond-rim-back', 'cream', -1.3, 1.3, -1.3, -1.05, 0, 0.14, { cast: false }),
  slab('pond-rim-front', 'cream', -1.3, 1.3, 1.05, 1.3, 0, 0.14, { cast: false }),
  slab('pond-rim-left', 'cream', -1.3, -1.05, -1.05, 1.05, 0, 0.14, { cast: false }),
  slab('pond-rim-right', 'cream', 1.05, 1.3, -1.05, 1.05, 0, 0.14, { cast: false }),
  slab('pond-water', 'water', -1.05, 1.05, -1.05, 1.05, 0, 0.07, { cast: false }),
  ...roadTiles(),
]

// ── Props ────────────────────────────────────────────────────────────────────

export type PropSpec =
  | { kind: 'tree'; id: string; at: Vec3; scale: number }
  | { kind: 'bush'; id: string; at: Vec3; scale: number }
  | { kind: 'rock'; id: string; at: Vec3; scale: number }
  | { kind: 'flower'; id: string; at: Vec3; color: PaletteKey }
  | { kind: 'cloud'; id: string; at: Vec3; scale: number }

export const PROPS: readonly PropSpec[] = [
  // Back-left hill
  { kind: 'tree', id: 'tree-left-a', at: [-5.6, 0.6, -0.9], scale: 1 },
  { kind: 'tree', id: 'tree-left-b', at: [-4.4, 0.3, 1.2], scale: 0.82 },
  { kind: 'bush', id: 'bush-left', at: [-6.1, 0.3, 1.4], scale: 1 },
  // Back-right hill
  { kind: 'tree', id: 'tree-right-a', at: [0.9, 0.6, -5.6], scale: 1 },
  { kind: 'tree', id: 'tree-right-b', at: [-1.3, 0.3, -4.5], scale: 0.82 },
  { kind: 'bush', id: 'bush-right', at: [1.7, 0.3, -4.2], scale: 0.9 },
  // Front strips stay low so nothing hides the road.
  { kind: 'bush', id: 'bush-front-left', at: [-0.7, 0, 5.9], scale: 0.9 },
  { kind: 'rock', id: 'rock-front-left', at: [1.3, 0, 5.3], scale: 0.8 },
  { kind: 'bush', id: 'bush-front-right', at: [5.7, 0, 0.9], scale: 0.85 },
  { kind: 'rock', id: 'rock-front-right', at: [5.1, 0, -1.4], scale: 0.7 },
  // Sand terrace
  { kind: 'rock', id: 'rock-sand-a', at: [5.9, -0.22, 4.2], scale: 1 },
  { kind: 'rock', id: 'rock-sand-b', at: [4.3, -0.22, 6.1], scale: 0.65 },
  // Flowers
  { kind: 'flower', id: 'flower-1', at: [0.3, 0, 4.6], color: 'white' },
  { kind: 'flower', id: 'flower-2', at: [0.8, 0, 6.2], color: 'yellow' },
  { kind: 'flower', id: 'flower-3', at: [-1.6, 0, 4.9], color: 'coral' },
  { kind: 'flower', id: 'flower-4', at: [4.6, 0, 0.2], color: 'white' },
  { kind: 'flower', id: 'flower-5', at: [6.3, 0, -0.6], color: 'yellow' },
  { kind: 'flower', id: 'flower-6', at: [4.4, 0, 1.9], color: 'coral' },
  { kind: 'flower', id: 'flower-7', at: [-3.9, 0.3, -1.6], color: 'white' },
  { kind: 'flower', id: 'flower-8', at: [-1.7, 0.3, -6.1], color: 'yellow' },
  // Clouds sit in the empty corners of the frame, off the island.
  { kind: 'cloud', id: 'cloud-left', at: [-10.4, 1.2, -0.4], scale: 1 },
  { kind: 'cloud', id: 'cloud-right', at: [0.8, 0.4, -11.2], scale: 0.8 },
  { kind: 'cloud', id: 'cloud-front', at: [10.6, -2.2, -0.2], scale: 0.9 },
]

// ── Camera framing ───────────────────────────────────────────────────────────

export interface FrameBox {
  min: Vec3
  max: Vec3
}

/**
 * Everything the overview camera must always contain: the island with its stepped
 * underside, the tallest object in each zone, and the trees on the two hills.
 */
export const FRAME_BOXES: readonly FrameBox[] = [
  { min: [-ISLAND_HALF, -1.2, -ISLAND_HALF], max: [ISLAND_HALF, 0.4, ISLAND_HALF] },
  { min: [-6.6, -2.1, -6.6], max: [6.6, -1.2, 6.6] },
  { min: [-6.0, -3.0, -6.0], max: [6.0, -2.1, 6.0] },
  { min: [-5.4, -3.9, -5.4], max: [5.4, -3.0, 5.4] },
  { min: [-6.7, 0, -2.2], max: [-3.7, 2.5, 2.0] },
  { min: [-2.0, 0, -6.7], max: [2.2, 2.5, -3.7] },
  ...Object.values(ZONES).map(
    (zone): FrameBox => ({
      min: [zone.bounds[0], 0, zone.bounds[1]],
      max: [zone.bounds[2], zone.topY, zone.bounds[3]],
    }),
  ),
]

export const CAMERA = {
  /** Degrees around the y axis. 45 gives the classic isometric diamond. */
  azimuth: 45,
  /** Elevation for wide (landscape) stages: true isometric. */
  elevationWide: 35.264,
  /** A slightly higher view makes the board taller on portrait stages. */
  elevationTall: 47,
  /** Fraction of the safe area the island may fill. */
  fill: 0.92,
  /**
   * Below this many pixels per world unit, selecting a mission eases the camera toward its
   * zone. Measured overview zooms: phones 12 to 18, a 1024 by 768 window 27, laptops 31 and
   * up. So the camera moves only on phone-sized windows and holds still everywhere else.
   */
  focusBelowZoom: 24,
  /** Limits for that single focus move. */
  focusMaxFactor: 2.4,
  focusMaxZoom: 46,
} as const
