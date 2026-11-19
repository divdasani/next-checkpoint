import { useState, type ReactNode } from 'react'
import { useGame } from '../state/GameContext.tsx'
import type { MissionId } from '../state/types.ts'
import { Block, HitTarget } from './kit.tsx'
import { MISSION_COLOR, PALETTE, ZONES } from './layout.ts'

const FRAME = 0.16

/**
 * Wraps a mission zone. It makes the whole zone one big click target for selecting the
 * destination, and draws the outline that highlights the hovered or active zone.
 * Mission objects (the children) add their own smaller targets once the zone is active.
 */
export function ZoneShell({ id, children }: { id: MissionId; children: ReactNode }) {
  const { state, dispatch } = useGame()
  const [hovering, setHovering] = useState(false)
  const zone = ZONES[id]
  const [minX, minZ, maxX, maxZ] = zone.bounds
  const active = state.activeMission === id
  const midX = (minX + maxX) / 2
  const midZ = (minZ + maxZ) / 2
  const width = maxX - minX
  const depth = maxZ - minZ
  const color = active ? MISSION_COLOR[id] : PALETTE.white
  const y = 0.05

  return (
    <group>
      {children}
      {(active || hovering) && (
        <>
          <Block at={[midX, y, minZ - FRAME / 2]} size={[width + FRAME * 2, 0.1, FRAME]} color={color} cast={false} />
          <Block at={[midX, y, maxZ + FRAME / 2]} size={[width + FRAME * 2, 0.1, FRAME]} color={color} cast={false} />
          <Block at={[minX - FRAME / 2, y, midZ]} size={[FRAME, 0.1, depth]} color={color} cast={false} />
          <Block at={[maxX + FRAME / 2, y, midZ]} size={[FRAME, 0.1, depth]} color={color} cast={false} />
        </>
      )}
      <HitTarget
        enabled={!active}
        at={[midX, zone.topY / 2, midZ]}
        size={[width, zone.topY, depth]}
        onActivate={() => dispatch({ type: 'SELECT_MISSION', mission: id })}
        onHoverChange={setHovering}
      />
    </group>
  )
}
