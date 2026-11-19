import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { content } from '../content/content.ts'
import { RESUME_LABELS } from '../content/resumeHtml.ts'
import { useGame } from '../state/GameContext.tsx'
import { Resume } from './Resume.tsx'

// The resume in a sheet that opens over the world.
//
// How it connects to state: the sheet is open exactly when state.resumeOpen is true.
// Every "Read resume" button on the site dispatches OPEN_RESUME. Close, the Escape key,
// and a click outside the sheet all end in CLOSE_RESUME. Nothing here touches the missions,
// so the resume works the same before playing, during play, in the Guided tour and Film
// mode, and when the 3D world could not start. While it is open the address ends in
// "#resume" (see state/url.ts), so the open resume can be linked to directly.
//
// The <dialog> element is always on the page, even while closed. That is what lets
// print.css put the resume on paper whether or not the sheet is open.
//
// A browser's built-in dialog already does the hard parts: it keeps keyboard focus inside
// while open, closes on Escape, and returns focus to the button that opened it.

/** Small line drawings for the toolbar buttons. Decorative: each button also has a text label. */
const ICON_PATHS = {
  print: 'M4.6 6V2.6h6.8V6M4.6 11.4H2.8V6h10.4v5.4h-1.8M4.6 9.2h6.8v4.2H4.6z',
  external: 'M9.4 2.8h3.8v3.8M13 3L7.6 8.4M11.4 9.6v3.6H2.8V4.6h3.6',
  download: 'M8 2.6v7.4M4.8 7L8 10.2 11.2 7M3 13.2h10',
  close: 'M4 4l8 8M12 4l-8 8',
} as const

function ToolbarIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg className="resume-dialog__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

/**
 * True when a mouse event landed outside the sheet, on the dimmed area around it.
 * The browser reports such clicks on the dialog element itself, so the position is
 * compared with the sheet's box to tell them apart from clicks on its border.
 */
function isOnBackdrop(event: ReactMouseEvent<HTMLDialogElement>): boolean {
  const dialog = event.currentTarget
  if (event.target !== dialog) return false
  const box = dialog.getBoundingClientRect()
  return (
    event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
  )
}

export function ResumeDialog() {
  const { state, dispatch } = useGame()
  const { resumeOpen } = state
  const { finale, identity, resume } = content

  const dialogRef = useRef<HTMLDialogElement>(null)
  // Remembers whether the current mouse press began on the backdrop. Selecting text and
  // letting go outside the sheet must not close it.
  const pressBeganOnBackdrop = useRef(false)
  // True from the moment the sheet opens or closes until the next separate click.
  // Used below to drop the second click of a double-click.
  const justToggled = useRef(false)
  const titleId = useId()
  const headingId = useId()

  // Follow the state: open the sheet when resumeOpen turns true, close it when it turns false.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (resumeOpen && !dialog.open) {
      // showModal() is the browser's own way to open a dialog on top of everything else.
      // Where it is missing (the test environment), the "open" attribute still shows the sheet.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      // Start at the top with focus on the name, so the keyboard can scroll and a screen
      // reader starts reading at the beginning. Shift+Tab reaches the toolbar.
      dialog.scrollTop = 0
      document.getElementById(headingId)?.focus({ preventScroll: true })
      justToggled.current = true
    } else if (!resumeOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
      justToggled.current = true
    }
  }, [resumeOpen, headingId])

  // A browser hands focus back to the button that opened the sheet. During the Guided tour
  // or a Film take that is the wrong place: Space would open the resume again instead of
  // resuming the sequence. So focus goes to the tour controls (Guided tour) or is let go
  // (Film mode, where nothing should light up in a recording), and Space resumes as expected.
  const wasOpen = useRef(resumeOpen)
  const { mode } = state
  useEffect(() => {
    const closedNow = wasOpen.current && !resumeOpen
    wasOpen.current = resumeOpen
    if (!closedNow || mode === 'play') return
    const tourBar = document.querySelector<HTMLElement>('.tourbar')
    if (mode === 'tour' && tourBar) tourBar.focus({ preventScroll: true })
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [resumeOpen, mode])

  // Some visitors double-click buttons. The first click opens or closes the sheet, and the
  // second would land on whatever is under the pointer by then: the Close button, a link,
  // or a button of the page beneath (which could restart the tour). Browsers number the
  // clicks of such a series in event.detail, so the rest of the series is dropped here.
  // The next separate click (detail 1, or 0 from the keyboard) ends the guard.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!justToggled.current) return
      if (event.detail > 1) {
        event.preventDefault()
        event.stopPropagation()
      } else {
        justToggled.current = false
      }
    }
    // "true" makes this run before any button sees the click.
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [])

  const close = () => dispatch({ type: 'CLOSE_RESUME' })

  return (
    <dialog
      ref={dialogRef}
      className="resume-dialog"
      aria-labelledby={`${titleId} ${headingId}`}
      // The browser fires "close" after Escape (or any other way the dialog closes).
      // Telling the state keeps resumeOpen and the address bar in step with what is on screen.
      // The event arrives a moment late, so it is ignored if the sheet has been opened again.
      onClose={() => {
        if (!dialogRef.current?.open) close()
      }}
      onMouseDown={(event) => {
        pressBeganOnBackdrop.current = isOnBackdrop(event)
      }}
      onClick={(event) => {
        if (pressBeganOnBackdrop.current && isOnBackdrop(event)) close()
        pressBeganOnBackdrop.current = false
      }}
    >
      {/* Stays at the top of the sheet while the resume scrolls under it. Hidden on paper. */}
      <div className="resume-dialog__toolbar">
        <p id={titleId} className="resume-dialog__title eyebrow">
          Resume
        </p>
        <div className="resume-dialog__actions">
          <button type="button" className="btn btn--primary resume-dialog__btn" onClick={() => window.print()}>
            <ToolbarIcon name="print" />
            Print resume
          </button>
          <a className="btn resume-dialog__btn" href={identity.linkedInUrl} target="_blank" rel="noopener noreferrer">
            {finale.linkedInLabel}
            <ToolbarIcon name="external" />
            <span className="visually-hidden">{` ${RESUME_LABELS.newTab}`}</span>
          </a>
          {/* Shown only once a public PDF is set in content.ts. Until then there is no button at all. */}
          {resume.publicPdf && (
            <a className="btn resume-dialog__btn" href={resume.publicPdf.href} download>
              <ToolbarIcon name="download" />
              {resume.publicPdf.label}
            </a>
          )}
          <button type="button" className="btn resume-dialog__btn resume-dialog__close" onClick={close}>
            <ToolbarIcon name="close" />
            Close
          </button>
        </div>
      </div>

      <div className="resume-dialog__body">
        <Resume headingId={headingId} />
      </div>
    </dialog>
  )
}
