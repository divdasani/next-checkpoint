import type { RoadStopId, StopId } from '../state/types.ts'
import { POND_HALF, RING, RING_ORDER, STOPS, type Vec3 } from './layout.ts'

// The avatar never roams. It moves along the ring road between its four corners,
// so a route is just the list of road corners from one stop to another.
//
// The one place off the road is the middle of the pond, where the ending is celebrated.
// The avatar reaches it from the middle of a road, straight in, so it still never cuts
// across the grass.

const COUNT = RING_ORDER.length

/** The road corner a stop stands on. The first checkpoint shares the home corner. */
function corner(stop: RoadStopId): RoadStopId {
  return stop === 'discover' ? 'home' : stop
}

/** Stops visited in order when travelling along the road from one stop to another, both ends included. */
export function routeStops(from: RoadStopId, to: RoadStopId): RoadStopId[] {
  // Same corner: nothing to walk. Home to the first checkpoint is this case.
  if (corner(from) === corner(to)) return [to]
  const start = RING_ORDER.indexOf(corner(from))
  const end = RING_ORDER.indexOf(corner(to))
  const forward = (end - start + COUNT) % COUNT
  // The corners on the way, with the two ends under the names the trip was asked for.
  const walk = (step: 1 | -1, hops: number) =>
    Array.from({ length: hops + 1 }, (_, i) =>
      i === 0 ? from : i === hops ? to : RING_ORDER[(start + step * i + COUNT * COUNT) % COUNT],
    )

  if (forward < COUNT - forward) return walk(1, forward)
  if (forward > COUNT - forward) return walk(-1, COUNT - forward)
  // Opposite corners: both ways are equally long. Prefer passing the start plaza,
  // and otherwise the hub, so the same trip always looks the same.
  const ahead = walk(1, forward)
  const behind = walk(-1, forward)
  const rank = (stops: RoadStopId[]) => (stops[1] === 'home' ? 0 : stops[1] === 'network' ? 1 : 2)
  return rank(ahead) <= rank(behind) ? ahead : behind
}

// ── The way to the pond ──────────────────────────────────────────────────────

/**
 * The middle of each side of the ring road: where the avatar leaves the road for the pond.
 * GATES[i] lies between RING_ORDER[i] and the corner after it.
 */
export const GATES: readonly Vec3[] = RING_ORDER.map((stop, index): Vec3 => {
  const a = STOPS[stop]
  const b = STOPS[RING_ORDER[(index + 1) % COUNT]]
  return [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]
})

/** The two sides nearest the camera come first, so the walk to the pond is in plain view when it can be. */
const GATE_RANK: readonly number[] = [0, 3, 1, 2]

/** How far from the middle the avatar steps down into the water: just inside the rim. */
const WATER_EDGE = POND_HALF - 0.15

/** The gate a stop uses: the middle of one of the two roads that meet at its corner. */
export function gateFor(stop: RoadStopId): number {
  const index = RING_ORDER.indexOf(corner(stop))
  const before = (index + COUNT - 1) % COUNT
  return GATE_RANK.indexOf(index) <= GATE_RANK.indexOf(before) ? index : before
}

/** From a gate straight in: the gate, the water's edge, and the middle of the pond. */
export function pondPath(gate: number): Vec3[] {
  const [x, , z] = GATES[gate]
  const scale = WATER_EDGE / Math.hypot(x, z)
  return [GATES[gate], [x * scale, 0, z * scale], STOPS.center]
}

/** The points to walk through from one stop to another, both ends included. */
export function routeBetween(from: StopId, to: StopId): Vec3[] {
  // To the pond: along the road to the middle of a side, then straight in. Back out the same way.
  if (to === 'center') return from === 'center' ? [STOPS.center] : [STOPS[from], ...pondPath(gateFor(from))]
  if (from === 'center') return [...pondPath(gateFor(to)).reverse(), STOPS[to]]
  return routeStops(from, to).map((stop) => STOPS[stop])
}

/**
 * A route for a destination chosen in the middle of a walk, starting from wherever the
 * avatar is. It never jumps and never cuts across the grass.
 *
 * On a road the avatar is between two corners. It leaves by whichever of them gives the
 * shorter walk, or by that road's own gate when it is headed for the pond. Between a road
 * and the pond it is on a gate's straight path, so it carries on to the middle, or goes
 * back out through that gate.
 */
export function routeFrom(here: Vec3, to: StopId): Vec3[] {
  const distance = (point: Vec3) => Math.hypot(here[0] - point[0], here[2] - point[2])
  const shorter = (one: Vec3[], other: Vec3[]) => (routeLength(one) <= routeLength(other) ? one : other)
  const inside = Math.max(Math.abs(here[0]), Math.abs(here[2])) < RING - 1e-6
  const gate = GATES.map((_, index) => index).sort((a, b) => distance(GATES[a]) - distance(GATES[b]))[0]

  if (to === 'center') return inside ? [here, STOPS.center] : [here, ...pondPath(gate)]
  if (inside) {
    const out: Vec3[] = [here, GATES[gate]]
    const corners = [RING_ORDER[gate], RING_ORDER[(gate + 1) % COUNT]]
    return shorter([...out, ...routeBetween(corners[0], to)], [...out, ...routeBetween(corners[1], to)])
  }
  const [nearest, next] = [...RING_ORDER].sort((a, b) => distance(STOPS[a]) - distance(STOPS[b]))
  return shorter([here, ...routeBetween(nearest, to)], [here, ...routeBetween(next, to)])
}

export function routeLength(points: readonly Vec3[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2])
  }
  return total
}

export interface RoutePoint {
  position: Vec3
  /** Heading in radians around +y: 0 faces +z, a quarter turn faces +x. */
  heading: number
}

/** Position and heading after travelling `distance` along a route (clamped to its ends). */
export function pointAlong(points: readonly Vec3[], distance: number): RoutePoint {
  if (points.length === 1) return { position: points[0], heading: 0 }
  let remaining = Math.max(0, distance)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b[0] - a[0]
    const dz = b[2] - a[2]
    const length = Math.hypot(dx, dz)
    const heading = Math.atan2(dx, dz)
    if (remaining <= length || i === points.length - 1) {
      const t = length === 0 ? 1 : Math.min(1, remaining / length)
      return { position: [a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t], heading }
    }
    remaining -= length
  }
  return { position: points[points.length - 1], heading: 0 }
}
