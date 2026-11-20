import { useEffect, useId, useRef } from 'react'
import { Icon, StatusMark } from './parts.tsx'

// Spot the Gap, Find the Signal, and Launch Day share one shape: three steps to switch on,
// then one main action that only works once all three are done. This component draws that shape.
// MissionPanel gives it the words, the current state, and what to dispatch.

/** The explanation the reducer stores when the main action is pressed too early. */
interface StepHint<Id extends string> {
  missing: readonly Id[]
  next: Id
  /** Goes up on every early press, so the box can nudge again each time. */
  attempts: number
}

interface StepControlsProps<Id extends string> {
  /** The three steps in the order they are shown. */
  ids: readonly Id[]
  /** Readable name of each step. */
  labels: Readonly<Record<Id, string>>
  /** Which steps are done, straight from game state. */
  done: Readonly<Record<Id, boolean>>
  /** Status word for a step that is still to do, for example "Off". */
  todoWord: string
  /** Status word for a finished step, for example "On". */
  doneWord: string
  /** Label of the main action, for example "Launch". */
  actionLabel: string
  /** Set by the reducer after an early press of the main action, otherwise null. */
  hint: StepHint<Id> | null
  /** Builds the explanation from the names of the missing steps. */
  blocked: (missing: readonly string[]) => string
  /** Builds the label of the button that does the next step. */
  nextAction: (label: string) => string
  onStep: (id: Id) => void
  onAction: () => void
}

/**
 * Scrolls the panel just far enough to show an element, without animation.
 * It does nothing when the element is already in view. On a short phone sheet the
 * lower part of a mission panel can start out of sight.
 *
 * Only the panel's own scrolling box moves. (The browser's scrollIntoView would also shift
 * the page behind it, which cannot be scrolled back by hand.)
 */
function reveal(element: HTMLElement | null) {
  const sheet = element?.closest<HTMLElement>('.stage-panel')
  if (!element || !sheet) return
  const box = element.getBoundingClientRect()
  const view = sheet.getBoundingClientRect()
  const margin = 8
  if (box.bottom > view.bottom) sheet.scrollTop += box.bottom - view.bottom + margin
  else if (box.top < view.top) sheet.scrollTop -= view.top - box.top + margin
}

export function StepControls<Id extends string>({
  ids,
  labels,
  done,
  todoWord,
  doneWord,
  actionLabel,
  hint,
  blocked,
  nextAction,
  onStep,
  onAction,
}: StepControlsProps<Id>) {
  const baseId = useId()
  const hintTextId = `${baseId}-hint`
  const stepDomId = (id: Id) => `${baseId}-${id}`
  const hintBox = useRef<HTMLDivElement>(null)
  const actionButton = useRef<HTMLButtonElement>(null)
  const ready = ids.every((id) => done[id])
  const attempts = hint?.attempts ?? 0

  // Show the explanation each time the main action is pressed too early.
  useEffect(() => {
    if (attempts > 0) reveal(hintBox.current)
  }, [attempts])

  // Show the main action as soon as the last step is done, so the next move is obvious.
  useEffect(() => {
    if (ready) reveal(actionButton.current)
  }, [ready])

  // The hint's button does the next step. The reducer then clears the hint, which removes
  // that button, so keyboard focus moves to the step that was just switched on.
  const doNextStep = (next: Id) => {
    onStep(next)
    document.getElementById(stepDomId(next))?.focus()
  }

  return (
    <>
      <ul className="mission__steps" role="list">
        {ids.map((id) => {
          const isDone = done[id]
          const isNext = hint?.next === id
          const classes = ['btn', 'mission__toggle', isDone ? 'is-done' : '', isNext ? 'is-next' : '']
          return (
            <li key={id}>
              <button
                type="button"
                id={stepDomId(id)}
                className={classes.filter(Boolean).join(' ')}
                aria-pressed={isDone}
                onClick={() => onStep(id)}
              >
                <StatusMark done={isDone} />
                <span className="mission__toggle-label">{labels[id]}</span>
                {/* Hidden commas, so a screen reader hears "Revenue, Next, Off" as three things. */}
                <span className="visually-hidden">, </span>
                {isNext && (
                  <>
                    <span className="mission__next-tag">Next</span>
                    <span className="visually-hidden">, </span>
                  </>
                )}
                <span className="mission__toggle-state">{isDone ? doneWord : todoWord}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mission__go">
        {/* Not ready yet: the button looks dashed but still works, so pressing it can explain why. */}
        <button
          type="button"
          ref={actionButton}
          className={ready ? 'btn btn--primary btn--block mission__action' : 'btn btn--block mission__action'}
          aria-disabled={ready ? undefined : true}
          aria-describedby={hint ? hintTextId : undefined}
          onClick={onAction}
        >
          {actionLabel}
        </button>

        {/* The key restarts the nudge animation on every early press. */}
        {hint && (
          <div key={hint.attempts} ref={hintBox} className="mission__hint nudge">
            <p id={hintTextId} className="mission__hint-text">
              <span className="mission__hint-mark" aria-hidden="true">
                !
              </span>
              <span>{blocked(hint.missing.map((id) => labels[id]))}</span>
            </p>
            <button type="button" className="btn btn--primary" onClick={() => doNextStep(hint.next)}>
              {nextAction(labels[hint.next])}
              <Icon name="next" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
