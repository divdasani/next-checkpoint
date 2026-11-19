import type { StopId } from '../state/types.ts'
import { RING_ORDER, STOPS, type Vec3 } from './layout.ts'

// The avatar never roams. It moves along the ring road between four fixed stops,
// so a route is just the list of road corners from one stop to another.

const COUNT = RING_ORDER.length

/** Stops visited in order when travelling from one stop to another, both ends included. */
export function routeStops(from: StopId, to: StopId): StopId[] {
  if (from === to) return [from]
  const start = RING_ORDER.indexOf(from)
  const end = RING_ORDER.indexOf(to)
  const forward = (end - start + COUNT) % COUNT
  const walk = (step: 1 | -1, hops: number) =>
    Array.from({ length: hops + 1 }, (_, i) => RING_ORDER[(start + step * i + COUNT * COUNT) % COUNT])

  if (forward < COUNT - forward) return walk(1, forward)
  if (forward > COUNT - forward) return walk(-1, COUNT - forward)
  // Opposite corners: both ways are equally long. Prefer passing the start plaza,
  // and otherwise the first mission, so the same trip always looks the same.
  const ahead = walk(1, forward)
  const behind = walk(-1, forward)
  const rank = (stops: StopId[]) => (stops[1] === 'home' ? 0 : stops[1] === 'network' ? 1 : 2)
  return rank(ahead) <= rank(behind) ? ahead : behind
}

export function routeBetween(from: StopId, to: StopId): Vec3[] {
  return routeStops(from, to).map((stop) => STOPS[stop])
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
