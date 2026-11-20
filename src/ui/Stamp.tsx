import type { ReactNode } from 'react'
import type { MissionId } from '../state/types.ts'

// The four passport stamps: one drawing per checkpoint, in that checkpoint's color.
// A stamp space starts out empty (a dashed ring with the checkpoint's number) and shows
// its drawing once the checkpoint is complete. The drawings are inline, so the site needs
// no image files. Every stamp is decorative: the words next to it carry the meaning.

/** Line drawings on a 24 by 24 grid. */
const STAMP_ART: Record<MissionId, ReactNode> = {
  // Discovery: a magnifying glass.
  discover: (
    <>
      <circle cx="10.5" cy="10.5" r="5.6" />
      <path d="M14.7 14.7l5 5" />
    </>
  ),
  // Builder: a hammer.
  signal: (
    <>
      <path d="M4.6 19.4l7.6-7.6" />
      <path d="M10.6 7.2l3.4-3.4 6.2 6.2-3.4 3.4z" />
    </>
  ),
  // Launch: a rocket.
  launch: (
    <>
      <path d="M12 2.8c3 2.3 4.4 5.5 4.4 9.3L15 15.4H9l-1.4-3.3c0-3.8 1.4-7 4.4-9.3z" />
      <circle cx="12" cy="9.4" r="1.5" />
      <path d="M9 15.4l-2 3.4M15 15.4l2 3.4M12 17.6v3.2" />
    </>
  ),
  // Scale: a small network that has grown from one point.
  network: (
    <>
      <circle cx="12" cy="5.6" r="2.3" />
      <circle cx="5.4" cy="17.6" r="2.3" />
      <circle cx="18.6" cy="17.6" r="2.3" />
      <path d="M10.9 7.6l-4.3 8M13.1 7.6l4.3 8M7.7 17.6h8.6" />
    </>
  ),
}

interface StampProps {
  mission: MissionId
  /** False shows the empty space, true the stamp. */
  earned: boolean
  /** The checkpoint's number, shown in the empty space. */
  number: number
  /** s for the passport strip, m for lists, l for the card and the passport view. */
  size?: 's' | 'm' | 'l'
  /** Play the stamp coming down once, for the moment it is earned. */
  fresh?: boolean
}

export function Stamp({ mission, earned, number, size = 's', fresh = false }: StampProps) {
  return (
    <span
      className="stamp"
      data-mission={mission}
      data-size={size}
      data-earned={earned ? 'true' : 'false'}
      data-fresh={fresh && earned ? 'true' : undefined}
      aria-hidden="true"
    >
      {earned ? (
        <svg className="stamp__art" viewBox="0 0 24 24" focusable="false">
          {STAMP_ART[mission]}
        </svg>
      ) : (
        number
      )}
    </span>
  )
}

/** The outline of the sticker: a seal with 14 small points, on a 48 by 48 grid. */
const SEAL = Array.from({ length: 28 }, (_, i) => {
  const radius = i % 2 === 0 ? 22.4 : 19.6
  const angle = (Math.PI * 2 * i) / 28 - Math.PI / 2
  return `${(24 + radius * Math.cos(angle)).toFixed(2)},${(24 + radius * Math.sin(angle)).toFixed(2)}`
}).join(' ')

interface EmptyStampProps {
  size?: 's' | 'm' | 'l'
  /** Words for a sticker stuck over the space. The space itself stays unearned. */
  sticker?: string
  /** Play the sticker being pressed on, once. */
  fresh?: boolean
}

/**
 * The space kept for a checkpoint that lies beyond this trail. It can never be earned here,
 * so it never becomes a stamp. It can carry a sticker: a seal that sits on top of the
 * dashed ring, a little larger than it and tilted, the way a sticker is put on by hand.
 */
export function EmptyStamp({ size = 'l', sticker, fresh = false }: EmptyStampProps) {
  return (
    <span className="stamp stamp--next" data-size={size} data-earned="false" aria-hidden="true">
      {sticker && (
        <svg className="sticker" viewBox="0 0 48 48" focusable="false" data-fresh={fresh ? 'true' : undefined}>
          <polygon className="sticker__shadow" points={SEAL} transform="translate(1.7 1.7)" />
          <polygon className="sticker__seal" points={SEAL} />
          {/* textLength keeps the word inside the seal whatever font the browser ends up with. */}
          <text className="sticker__word" x="24" y="27.5" textAnchor="middle" textLength="30" lengthAdjust="spacingAndGlyphs">
            {sticker}
          </text>
        </svg>
      )}
    </span>
  )
}
