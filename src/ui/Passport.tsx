import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { content, missionContent } from '../content/content.ts'
import { useGame } from '../state/GameContext.tsx'
import {
  allComplete,
  completedCount,
  isMissionComplete,
  isTourBusy,
  missionStatus,
  type MissionStatus,
} from '../state/selectors.ts'
import { MISSION_IDS } from '../state/types.ts'
import { IconCheck, IconHere, IconTodo } from './icons.tsx'
import { EmptyStamp, Stamp } from './Stamp.tsx'

// The passport: the trail's progress, always on screen.
//
// PassportStrip is the row under the world. It has a button that opens the passport and
// four stamp spaces, one per checkpoint. A space is empty until its checkpoint is
// complete, then it shows that checkpoint's stamp. Each space is also a shortcut:
// pressing it sends SELECT_MISSION, the same action as clicking that building.
//
// PassportDialog is the passport itself: all four stamps with the skills they unlocked,
// and one more space, never stamped, for the checkpoint that comes after this trail. Once
// the trail is complete that space carries the same sticker as the ending.
//
// Both read the same game state as everything else (isMissionComplete), so the strip, the
// passport, the cards, and the ending can never disagree about what has been earned.

// Status is always shown as an icon plus one of these words, never by color alone.
const STATUS_LABEL: Record<MissionStatus, string> = {
  todo: 'To do',
  active: 'Here',
  done: content.trail.stamped,
}

function StatusIcon({ status }: { status: MissionStatus }) {
  if (status === 'done') return <IconCheck />
  if (status === 'active') return <IconHere />
  return <IconTodo />
}

interface PassportStripProps {
  /** Opens the passport view. */
  onOpen: () => void
  /** True while the passport view is open, for the button's expanded state. */
  open: boolean
}

/**
 * While the guided sequence owns the world, and for the whole of Film mode, the strip is
 * inert: it keeps showing progress but cannot be pressed.
 */
export function PassportStrip({ onOpen, open }: PassportStripProps) {
  const { state, dispatch } = useGame()
  const { trail } = content
  const locked = isTourBusy(state) || state.mode === 'film'
  const done = completedCount(state)
  const progress = content.overview.progress(done)

  return (
    <>
      <nav className="chips" aria-label={trail.passport}>
        <button
          type="button"
          className="passport-tab"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${trail.passport}: ${progress}`}
          inert={locked}
          onClick={onOpen}
        >
          <span className="passport-tab__label">{trail.passport}</span>
          <span className="passport-tab__count">{trail.count(done)}</span>
        </button>

        {/* data-slim: the compact shape used for as long as the guided sequence is on screen. */}
        <ol className="chips__list" inert={locked} data-slim={state.mode === 'play' ? undefined : ''}>
          {MISSION_IDS.map((id) => {
            const mission = missionContent(id)
            const status = missionStatus(state, id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className="chips__chip"
                  data-mission={id}
                  data-status={status}
                  aria-current={state.activeMission === id ? 'true' : undefined}
                  onClick={() => dispatch({ type: 'SELECT_MISSION', mission: id })}
                >
                  <Stamp mission={id} earned={status === 'done'} number={mission.number} />
                  <span className="visually-hidden">
                    {trail.checkpoint} {mission.number}:{' '}
                  </span>
                  <span className="chips__title">{mission.checkpoint.name}</span>
                  <span className="chips__status">
                    <StatusIcon status={status} />
                    <span className="visually-hidden">, </span>
                    <span className="chips__word">{STATUS_LABEL[status]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <p className="chips__progress">{progress}</p>
    </>
  )
}

/** True when a mouse event landed outside the sheet, on the dimmed area around it. */
function isOnBackdrop(event: ReactMouseEvent<HTMLDialogElement>): boolean {
  const dialog = event.currentTarget
  if (event.target !== dialog) return false
  const box = dialog.getBoundingClientRect()
  return (
    event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
  )
}

interface PassportDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * The passport view. It opens over the world without changing anything in it, so closing
 * it leaves the visitor exactly where they were. Close, the Escape key, and a click
 * outside all close it. The browser's own dialog keeps keyboard focus inside while it is
 * open and hands focus back to the passport button afterwards.
 */
export function PassportDialog({ open, onClose }: PassportDialogProps) {
  const { state } = useGame()
  const { trail, finale, credit } = content
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressBeganOnBackdrop = useRef(false)
  const headingId = useId()
  const done = completedCount(state)
  // The sticker goes on with the ending, not before.
  const sticker = allComplete(state) ? trail.sticker : undefined

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      // Where showModal() is missing (the test environment), the "open" attribute still shows the sheet.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      dialog.scrollTop = 0
      document.getElementById(headingId)?.focus({ preventScroll: true })
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open, headingId])

  return (
    <dialog
      ref={dialogRef}
      className="passport-dialog"
      aria-labelledby={headingId}
      // The browser fires "close" after Escape. Telling the parent keeps its state in step.
      onClose={() => {
        if (!dialogRef.current?.open) onClose()
      }}
      onMouseDown={(event) => {
        pressBeganOnBackdrop.current = isOnBackdrop(event)
      }}
      onClick={(event) => {
        if (pressBeganOnBackdrop.current && isOnBackdrop(event)) onClose()
        pressBeganOnBackdrop.current = false
      }}
    >
      <div className="passport-dialog__head">
        <p className="eyebrow">{trail.passport}</p>
        <button type="button" className="btn passport-dialog__close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="passport-dialog__cover">
        <h2 id={headingId} className="title" tabIndex={-1}>
          {trail.name}
        </h2>
        <p className="passport-dialog__byline">{trail.byline}</p>
        <p className="passport-dialog__themes">{trail.themes}</p>
        <dl className="passport-dialog__profile">
          {trail.profile.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ol className="passport-dialog__stamps" role="list">
        {MISSION_IDS.map((id) => {
          const mission = missionContent(id)
          const { checkpoint } = mission
          const earned = isMissionComplete(state, id)
          return (
            <li key={id} className="passport-dialog__space" data-mission={id} data-earned={earned ? 'true' : 'false'}>
              <Stamp mission={id} earned={earned} number={mission.number} size="l" />
              <p className="passport-dialog__stamp-label">{checkpoint.stamp}</p>
              <p className="passport-dialog__checkpoint">
                {trail.checkpoint} {mission.number}
                <span aria-hidden="true"> · </span>
                <span className="visually-hidden">, </span>
                {checkpoint.name}
              </p>
              <p className="passport-dialog__state">
                {earned ? <IconCheck /> : null}
                {earned ? trail.stamped : trail.notStamped}
              </p>
              {earned && (
                <ul className="passport-dialog__skills" role="list" aria-label={trail.skillsUnlocked}>
                  {checkpoint.skills.map((skill) => (
                    <li key={skill} className="chip">
                      {skill}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>

      <p className="passport-dialog__progress">{content.overview.progress(done)}</p>

      {/* The space after the trail: where she hopes to go next. It is never stamped. */}
      <div className="passport-dialog__next">
        <EmptyStamp size="m" sticker={sticker} />
        <div>
          <p className="passport-dialog__next-title">{finale.heading}</p>
          <p className="note">
            {trail.notStamped}. {sticker && <span className="visually-hidden">Sticker: {sticker} </span>}
            {finale.applying}
          </p>
        </div>
      </div>

      <p className="note passport-dialog__credit">
        {credit.line} {trail.demo}
      </p>
    </dialog>
  )
}
