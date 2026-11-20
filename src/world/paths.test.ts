import { describe, expect, it } from 'vitest'
import type { RoadStopId } from '../state/types.ts'
import { PAD_TOP, POND_HALF, POND_WATER_TOP, RING, STOPS, type Vec3 } from './layout.ts'
import { GATES, pointAlong, routeBetween, routeFrom, routeLength, routeStops } from './paths.ts'

// The avatar never roams: it walks the square ring road between its four corners.
// These tests check the route it is given (which stops, in which order) and the
// point-on-route math that the walk animation reads every frame.
//
// The first checkpoint ('discover') stands on the home corner. It has its own tests near
// the end. Everything before that is about the four corners themselves. The last tests
// are about the one place off the road: the middle of the pond, where the ending is.

const STOP_IDS: RoadStopId[] = ['home', 'network', 'signal', 'launch']
type Trip = [from: RoadStopId, to: RoadStopId]
const PAIRS: Trip[] = STOP_IDS.flatMap((from) => STOP_IDS.map((to): Trip => [from, to]))
const DIFFERENT = PAIRS.filter(([from, to]) => from !== to)

/** Opposite corners of the ring. Every other pair of different stops is joined by one straight road. */
const OPPOSITE: Record<RoadStopId, RoadStopId> = {
  home: 'launch',
  discover: 'launch',
  launch: 'home',
  network: 'signal',
  signal: 'network',
}

/** Length of one side of the ring road, measured from the stop coordinates. */
const SIDE = Math.hypot(STOPS.network[0] - STOPS.home[0], STOPS.network[2] - STOPS.home[2])

const flat = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[2] - a[2])

/** The unit direction a heading points in, as [x, z]. Heading 0 faces +z and a quarter turn faces +x. */
const facing = (heading: number): [number, number] => [Math.sin(heading), Math.cos(heading)]

function expectPoint(actual: Vec3, expected: Vec3): void {
  expect(actual[0]).toBeCloseTo(expected[0], 9)
  expect(actual[1]).toBeCloseTo(expected[1], 9)
  expect(actual[2]).toBeCloseTo(expected[2], 9)
}

/** Check that a heading points from one point straight toward another. */
function expectFacing(heading: number, from: Vec3, to: Vec3): void {
  const length = flat(from, to)
  const [x, z] = facing(heading)
  expect(x).toBeCloseTo((to[0] - from[0]) / length, 9)
  expect(z).toBeCloseTo((to[2] - from[2]) / length, 9)
}

describe('the ring road itself', () => {
  it('is a square: every stop has two neighbors one side away and one opposite corner', () => {
    expect(SIDE).toBeGreaterThan(0)
    for (const stop of STOP_IDS) {
      const others = STOP_IDS.filter((other) => other !== stop)
      const distances = others.map((other) => flat(STOPS[stop], STOPS[other])).sort((a, b) => a - b)
      expect(distances[0]).toBeCloseTo(SIDE, 9)
      expect(distances[1]).toBeCloseTo(SIDE, 9)
      expect(distances[2]).toBeCloseTo(SIDE * Math.SQRT2, 9)
      expect(flat(STOPS[stop], STOPS[OPPOSITE[stop]])).toBeCloseTo(SIDE * Math.SQRT2, 9)
    }
  })
})

describe('routeStops: which stops a trip passes', () => {
  it.each(PAIRS)('%s to %s starts and ends at the right stops', (from, to) => {
    const route = routeStops(from, to)
    expect(route[0]).toBe(from)
    expect(route[route.length - 1]).toBe(to)
  })

  it.each(STOP_IDS)('staying at %s is a route of that one stop', (stop) => {
    expect(routeStops(stop, stop)).toEqual([stop])
  })

  it.each(DIFFERENT)('%s to %s only follows roads: every leg is one straight side of the ring', (from, to) => {
    const route = routeStops(from, to)
    for (let leg = 1; leg < route.length; leg++) {
      const a = STOPS[route[leg - 1]]
      const b = STOPS[route[leg]]
      // A road runs along one axis. A diagonal would cut across the pond in the middle.
      expect(a[0] === b[0] || a[2] === b[2], `${route[leg - 1]} to ${route[leg]}`).toBe(true)
      expect(flat(a, b)).toBeCloseTo(SIDE, 9)
    }
  })

  it.each(DIFFERENT)('%s to %s takes the short way: at most two hops and no stop twice', (from, to) => {
    const route = routeStops(from, to)
    const hops = route.length - 1
    expect(hops).toBe(OPPOSITE[from] === to ? 2 : 1)
    expect(new Set(route).size).toBe(route.length)
  })

  it('between opposite corners the avatar passes home when it can, and the hub otherwise', () => {
    // Both ways round are equally long, so the choice is fixed to keep the same trip looking the same.
    expect(routeStops('network', 'signal')).toEqual(['network', 'home', 'signal'])
    expect(routeStops('home', 'launch')).toEqual(['home', 'network', 'launch'])
  })

  it('the trip back mirrors the trip out', () => {
    expect(routeStops('signal', 'network')).toEqual(['signal', 'home', 'network'])
    expect(routeStops('launch', 'home')).toEqual(['launch', 'network', 'home'])
    for (const [from, to] of PAIRS) {
      expect(routeStops(to, from), `${to} to ${from}`).toEqual([...routeStops(from, to)].reverse())
    }
  })

  it('always gives the same route for the same trip', () => {
    for (const [from, to] of PAIRS) expect(routeStops(from, to)).toEqual(routeStops(from, to))
  })
})

describe('routeBetween and routeLength', () => {
  it('routeBetween gives the coordinates of the same stops, in order', () => {
    for (const [from, to] of PAIRS) {
      expect(routeBetween(from, to), `${from} to ${to}`).toEqual(routeStops(from, to).map((stop) => STOPS[stop]))
    }
  })

  it('a trip to a neighbor is 5 units long and a trip to the opposite corner is 10', () => {
    for (const [from, to] of DIFFERENT) {
      const expected = OPPOSITE[from] === to ? 10 : 5
      expect(routeLength(routeBetween(from, to)), `${from} to ${to}`).toBeCloseTo(expected, 9)
    }
  })

  it('staying put has no length', () => {
    for (const stop of STOP_IDS) expect(routeLength(routeBetween(stop, stop))).toBe(0)
  })

  it('measures along the ground and adds up every leg', () => {
    const route: Vec3[] = [
      [0, 0, 0],
      [3, 0, 4],
      [3, 5, 4],
      [3, 5, 6],
    ]
    // 5 along the first leg, nothing for the purely vertical step, 2 along the last.
    expect(routeLength(route)).toBeCloseTo(7, 9)
    expect(routeLength([])).toBe(0)
  })
})

describe('pointAlong: where the avatar is after walking some distance', () => {
  const oneLeg = routeBetween('home', 'network')
  const twoLegs = routeBetween('network', 'signal')
  const [start, corner, end] = twoLegs

  it('starts at the first stop, facing along the first road', () => {
    const point = pointAlong(oneLeg, 0)
    expectPoint(point.position, STOPS.home)
    expectFacing(point.heading, STOPS.home, STOPS.network)
  })

  it('is halfway along a single road at half its length', () => {
    const point = pointAlong(oneLeg, SIDE / 2)
    expectPoint(point.position, [(STOPS.home[0] + STOPS.network[0]) / 2, 0, (STOPS.home[2] + STOPS.network[2]) / 2])
    expectFacing(point.heading, STOPS.home, STOPS.network)
  })

  it('reaches the corner of a two-road trip exactly at the middle', () => {
    expectPoint(pointAlong(twoLegs, SIDE).position, corner)
  })

  it('faces along the first road before the corner and along the second road after it', () => {
    const before = pointAlong(twoLegs, SIDE * 0.5)
    expectPoint(before.position, [(start[0] + corner[0]) / 2, 0, (start[2] + corner[2]) / 2])
    expectFacing(before.heading, start, corner)

    const after = pointAlong(twoLegs, SIDE * 1.5)
    expectPoint(after.position, [(corner[0] + end[0]) / 2, 0, (corner[2] + end[2]) / 2])
    expectFacing(after.heading, corner, end)
  })

  it('arrives at the last stop at the full length, still facing along the last road', () => {
    const point = pointAlong(twoLegs, 2 * SIDE)
    expectPoint(point.position, STOPS.signal)
    expectFacing(point.heading, corner, end)
  })

  it('stays at the last stop when asked for more than the full length', () => {
    for (const distance of [2 * SIDE + 0.001, 25, 1e9]) {
      const point = pointAlong(twoLegs, distance)
      expectPoint(point.position, STOPS.signal)
      expectFacing(point.heading, corner, end)
    }
    expectPoint(pointAlong(oneLeg, 1e9).position, STOPS.network)
  })

  it('stays at the first stop for a negative distance', () => {
    expectPoint(pointAlong(twoLegs, -3).position, STOPS.network)
  })

  it('a route of one stop is simply that stop', () => {
    const route = routeBetween('launch', 'launch')
    for (const distance of [0, 1, 100]) expectPoint(pointAlong(route, distance).position, STOPS.launch)
  })

  it.each(DIFFERENT)('%s to %s: the walk stays on the road and never moves backwards', (from, to) => {
    const route = routeBetween(from, to)
    const length = routeLength(route)
    const half = SIDE / 2
    let previous = pointAlong(route, 0).position
    let walked = 0
    const steps = 40
    for (let step = 1; step <= steps; step++) {
      const { position } = pointAlong(route, (length * step) / steps)
      // On the square ring road: one coordinate is always at the road's distance from the center.
      expect(Math.max(Math.abs(position[0]), Math.abs(position[2]))).toBeCloseTo(half, 9)
      expect(position[1]).toBeCloseTo(0, 9)
      walked += flat(previous, position)
      previous = position
    }
    // Small equal steps that add up to exactly the route length: no jumps and no doubling back.
    expect(walked).toBeCloseTo(length, 9)
    expectPoint(previous, STOPS[to])
  })

  it('carries height along when a route climbs', () => {
    const climb: Vec3[] = [
      [0, 0, 0],
      [0, 2, 4],
    ]
    expectPoint(pointAlong(climb, 1).position, [0, 0.5, 1])
    expectPoint(pointAlong(climb, 4).position, [0, 2, 4])
  })

  it('copes with a route that begins with a zero-length leg (a new trip started exactly on a stop)', () => {
    // Avatar.tsx prefixes the current position when a trip is redirected mid-walk. If the
    // avatar happens to stand exactly on a stop, the first leg has no length at all.
    const route: Vec3[] = [STOPS.home, STOPS.home, STOPS.network]
    for (const distance of [0, 0.001, SIDE / 2, SIDE, SIDE + 1]) {
      const point = pointAlong(route, distance)
      expect(point.position.every(Number.isFinite), `distance ${distance}`).toBe(true)
      expect(Number.isFinite(point.heading), `distance ${distance}`).toBe(true)
    }
    expectPoint(pointAlong(route, SIDE / 2).position, [(STOPS.home[0] + STOPS.network[0]) / 2, 0, STOPS.home[2]])
    expectFacing(pointAlong(route, SIDE / 2).heading, STOPS.home, STOPS.network)
    expectPoint(pointAlong(route, SIDE).position, STOPS.network)
  })
})

describe('the first checkpoint shares the home corner', () => {
  const ELSEWHERE: RoadStopId[] = ['network', 'signal', 'launch']

  it('stands exactly where the avatar starts', () => {
    expect(STOPS.discover).toEqual(STOPS.home)
  })

  it('choosing it from home, or going home from it, is no walk at all', () => {
    expect(routeStops('home', 'discover')).toEqual(['discover'])
    expect(routeStops('discover', 'home')).toEqual(['home'])
    expect(routeStops('discover', 'discover')).toEqual(['discover'])
    expect(routeLength(routeBetween('home', 'discover'))).toBe(0)
    expect(routeLength(routeBetween('discover', 'home'))).toBe(0)
  })

  it.each(ELSEWHERE)('a trip between it and %s follows the same road as the trip from home', (stop) => {
    expect(routeBetween('discover', stop)).toEqual(routeBetween('home', stop))
    expect(routeBetween(stop, 'discover')).toEqual(routeBetween(stop, 'home'))
    // The two ends carry the names the trip was asked for.
    const out = routeStops('discover', stop)
    const back = routeStops(stop, 'discover')
    expect([out[0], out[out.length - 1]]).toEqual(['discover', stop])
    expect([back[0], back[back.length - 1]]).toEqual([stop, 'discover'])
    expect(back).toEqual([...out].reverse())
  })

  it('the trail is one lap of the ring: each next checkpoint is one road away', () => {
    const trail: RoadStopId[] = ['discover', 'signal', 'launch', 'network']
    for (let leg = 1; leg < trail.length; leg++) {
      const route = routeBetween(trail[leg - 1], trail[leg])
      expect(route, `${trail[leg - 1]} to ${trail[leg]}`).toHaveLength(2)
      expect(routeLength(route)).toBeCloseTo(SIDE, 9)
    }
    // And from the last checkpoint it is as far again to the middle of the pond, where the ending plays.
    expect(routeLength(routeBetween('network', 'center'))).toBeCloseTo(SIDE, 9)
  })
})

describe('the way to the middle of the pond, where the ending is celebrated', () => {
  const FROM: RoadStopId[] = ['home', 'discover', 'network', 'signal', 'launch']
  /** True when a leg runs along one axis: along a road, or straight in from the middle of one. */
  const straight = (a: Vec3, b: Vec3) => a[0] === b[0] || a[2] === b[2]

  it('the middle is the center of the island, in the water, a little below the pads', () => {
    expect([STOPS.center[0], STOPS.center[2]]).toEqual([0, 0])
    expect(STOPS.center[1]).toBeCloseTo(POND_WATER_TOP - PAD_TOP, 9)
    expect(STOPS.center[1]).toBeLessThan(0)
  })

  it('each road has one gate, in its middle', () => {
    expect(GATES).toEqual([
      [0, 0, RING],
      [-RING, 0, 0],
      [0, 0, -RING],
      [RING, 0, 0],
    ])
  })

  it.each(FROM)('%s to the middle: along the road to a gate, then straight in', (stop) => {
    const route = routeBetween(stop, 'center')
    expect(route).toHaveLength(4)
    const [start, gate, edge, middle] = route
    expect(start).toEqual(STOPS[stop])
    expect(middle).toEqual(STOPS.center)
    // The gate is the middle of one of the two roads that meet at this corner.
    expect(GATES).toContainEqual(gate)
    expect(flat(start, gate)).toBeCloseTo(SIDE / 2, 9)
    // No leg is a diagonal, so the avatar never cuts across the grass.
    for (let leg = 1; leg < route.length; leg++) expect(straight(route[leg - 1], route[leg]), `leg ${leg}`).toBe(true)
    // It stays at road height until it is over the water, and only then steps down.
    expect([start[1], gate[1], edge[1]]).toEqual([0, 0, 0])
    expect(Math.max(Math.abs(edge[0]), Math.abs(edge[2]))).toBeLessThan(POND_HALF)
    expect(routeLength(route)).toBeCloseTo(SIDE, 9)
  })

  it('uses a road that faces the camera when the corner has one', () => {
    const gateOf = (stop: RoadStopId) => routeBetween(stop, 'center')[1]
    expect(gateOf('home')).toEqual([0, 0, RING])
    expect(gateOf('discover')).toEqual([0, 0, RING])
    expect(gateOf('network')).toEqual([0, 0, RING])
    expect(gateOf('signal')).toEqual([RING, 0, 0])
    // The back corner touches neither front road.
    expect(gateOf('launch')).toEqual([-RING, 0, 0])
  })

  it.each(FROM)('the way back out to %s mirrors the way in', (stop) => {
    expect(routeBetween('center', stop)).toEqual([...routeBetween(stop, 'center')].reverse())
  })

  it('staying in the middle is no walk at all', () => {
    expect(routeBetween('center', 'center')).toEqual([STOPS.center])
    expect(routeLength(routeBetween('center', 'center'))).toBe(0)
  })

  it('the walk in goes down gently and never moves backwards', () => {
    const route = routeBetween('network', 'center')
    const length = routeLength(route)
    let previous = pointAlong(route, 0).position
    let walked = 0
    for (let step = 1; step <= 40; step++) {
      const { position } = pointAlong(route, (length * step) / 40)
      expect(position[1]).toBeLessThanOrEqual(previous[1] + 1e-12)
      walked += flat(previous, position)
      previous = position
    }
    expect(walked).toBeCloseTo(length, 9)
    expectPoint(previous, STOPS.center)
  })

  describe('a new destination chosen in the middle of a walk', () => {
    const onFrontRoad: Vec3 = [-1, 0, RING]
    const betweenGateAndPond: Vec3 = [0, -0.01, 1.8]

    it('from a road to the middle: on to that road\'s own gate, then straight in', () => {
      const route = routeFrom(onFrontRoad, 'center')
      expect(route[0]).toEqual(onFrontRoad)
      expect(route[1]).toEqual([0, 0, RING])
      expect(route[route.length - 1]).toEqual(STOPS.center)
      for (let leg = 1; leg < route.length; leg++) expect(straight(route[leg - 1], route[leg]), `leg ${leg}`).toBe(true)
    })

    it('from between a gate and the pond to the middle: straight on', () => {
      expect(routeFrom(betweenGateAndPond, 'center')).toEqual([betweenGateAndPond, STOPS.center])
    })

    it('from between a gate and the pond to a checkpoint: back out through the gate, then the shorter way round', () => {
      expect(routeFrom(betweenGateAndPond, 'signal')).toEqual([
        betweenGateAndPond,
        [0, 0, RING],
        STOPS.home,
        STOPS.signal,
      ])
      expect(routeFrom(betweenGateAndPond, 'network')).toEqual([betweenGateAndPond, [0, 0, RING], STOPS.network])
    })

    it('from a road to a checkpoint: by the nearer end of that road when that is shorter, and never across the pond', () => {
      const route = routeFrom([1, 0, RING], 'launch')
      expect(route).toEqual([[1, 0, RING], STOPS.network, STOPS.launch])
      for (const stop of STOP_IDS) {
        const walk = routeFrom(onFrontRoad, stop)
        expect(walk[walk.length - 1]).toEqual(STOPS[stop])
        for (let leg = 1; leg < walk.length; leg++) expect(straight(walk[leg - 1], walk[leg]), `${stop}, leg ${leg}`).toBe(true)
      }
    })
  })
})
