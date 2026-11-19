import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { content } from '../content/content.ts'
import { renderStaticResume, RESUME_LABELS } from '../content/resumeHtml.ts'
import { GameProvider, useGame } from '../state/GameContext.tsx'
import { createInitialState } from '../state/reducer.ts'
import { Resume } from './Resume.tsx'
import { ResumeDialog } from './ResumeDialog.tsx'

// What these tests protect:
//  - the resume shows every fact in content.ts and no private contact detail
//  - the sheet follows state.resumeOpen, and every way of closing it updates that state
//  - Print resume prints, and a PDF link appears only once a public PDF is set

const { identity, resume } = content

const PHONE_LIKE = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/
const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.]+/

afterEach(() => {
  // GameProvider writes "#resume" into the address while the sheet is open. Start each test clean.
  window.history.replaceState(null, '', window.location.pathname)
})

describe('Resume', () => {
  it('shows the name, the headline, and LinkedIn as the only contact', () => {
    const { container } = render(<Resume headingId="resume-name" />)

    const name = screen.getByRole('heading', { level: 2, name: resume.name })
    expect(name.id).toBe('resume-name')
    expect(screen.getByText(resume.headline)).toBeTruthy()
    expect(screen.getByText(resume.contactNote)).toBeTruthy()

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe(identity.linkedInUrl)
    // The visible text is the readable address. The rest is a note for screen readers.
    expect(links[0].firstChild?.textContent).toBe(identity.linkedInLabel)
    expect(links[0].textContent).toBe(`${identity.linkedInLabel} ${RESUME_LABELS.newTab}`)

    expect(container.textContent).not.toMatch(PHONE_LIKE)
    expect(container.textContent).not.toMatch(EMAIL_LIKE)
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull()
  })

  it('renders the summary and every skill as a list', () => {
    render(<Resume headingId="resume-name" />)

    expect(screen.getByRole('heading', { level: 3, name: RESUME_LABELS.summary })).toBeTruthy()
    expect(screen.getByText(resume.summary)).toBeTruthy()

    expect(screen.getByRole('heading', { level: 3, name: RESUME_LABELS.skills })).toBeTruthy()
    const skillList = screen.getAllByRole('list')[0]
    const skills = within(skillList)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(skills).toEqual([...resume.skills])
  })

  it('renders every section heading, entry, and bullet from the content', () => {
    const { container } = render(<Resume headingId="resume-name" />)

    for (const section of resume.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.heading })).toBeTruthy()
      for (const entry of section.entries) {
        expect(screen.getByRole('heading', { level: 4, name: entry.org })).toBeTruthy()
        expect(screen.getByText(entry.role)).toBeTruthy()
        expect(screen.getAllByText(entry.location).length).toBeGreaterThan(0)
        expect(screen.getByText(entry.dates)).toBeTruthy()
        // getByText fails when the text is missing and when it appears twice.
        for (const bullet of entry.bullets) expect(screen.getByText(bullet)).toBeTruthy()
      }
    }

    const bullets = resume.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets))
    const shown = [...container.querySelectorAll('.resume__bullets li')].map((item) => item.textContent)
    expect(shown).toEqual(bullets)
  })

  it('renders education', () => {
    render(<Resume headingId="resume-name" />)
    const { school, degree, location, date } = resume.education

    expect(screen.getByRole('heading', { level: 3, name: RESUME_LABELS.education })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: school })).toBeTruthy()
    expect(screen.getByText(degree)).toBeTruthy()
    expect(screen.getAllByText(location).length).toBeGreaterThan(0)
    expect(screen.getByText(date)).toBeTruthy()
  })

  it('has the same structure and words as the copy for visitors without JavaScript', () => {
    // The two copies are written separately (React here, a plain string in resumeHtml.ts).
    // This keeps them from drifting apart. Ids differ on purpose, so they are left out.
    const ignored = new Set(['id', 'aria-labelledby', 'tabindex'])
    const outline = (node: Node): string => {
      if (!(node instanceof Element)) return node.textContent ?? ''
      const attributes = [...node.attributes]
        .filter((attribute) => !ignored.has(attribute.name))
        .map((attribute) => ` ${attribute.name}="${attribute.value}"`)
        .sort()
        .join('')
      const children = [...node.childNodes].map(outline).join('')
      return `<${node.localName}${attributes}>${children}</${node.localName}>`
    }

    const { container } = render(<Resume headingId="resume-name" />)
    const fromReact = container.querySelector('article.resume')
    const fromString = new DOMParser()
      .parseFromString(renderStaticResume(content), 'text/html')
      .querySelector('article.resume')

    expect(fromReact).not.toBeNull()
    expect(fromString).not.toBeNull()
    expect(outline(fromString!)).toBe(outline(fromReact!))
  })
})

/** Shows state.resumeOpen as text and opens the resume when clicked, like any "Read resume" button. */
function StateProbe() {
  const { state, dispatch } = useGame()
  return (
    <button type="button" onClick={() => dispatch({ type: 'OPEN_RESUME' })}>
      {state.resumeOpen ? 'state says open' : 'state says closed'}
    </button>
  )
}

function renderDialog(options: { resumeOpen: boolean }) {
  const initialState = options.resumeOpen ? createInitialState({ resumeOpen: true }) : createInitialState()
  const view = render(
    <GameProvider initialState={initialState}>
      <StateProbe />
      <ResumeDialog />
    </GameProvider>,
  )
  const dialog = view.container.querySelector<HTMLDialogElement>('dialog.resume-dialog')
  if (!dialog) throw new Error('The resume dialog is not on the page')
  return { ...view, dialog }
}

/** Gives the sheet a position on screen (jsdom has no layout), so clicks can land inside or outside it. */
function placeSheet(dialog: HTMLDialogElement) {
  const box = { x: 100, y: 100, left: 100, top: 100, right: 500, bottom: 500, width: 400, height: 400 }
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ ...box, toJSON: () => box })
}

const OUTSIDE = { clientX: 20, clientY: 20 }
const INSIDE = { clientX: 300, clientY: 300 }

describe('ResumeDialog', () => {
  it('is on the page but closed when state.resumeOpen is false', () => {
    const { dialog } = renderDialog({ resumeOpen: false })

    expect(dialog.open).toBe(false)
    expect(screen.getByText('state says closed')).toBeTruthy()
    // The resume is in the page even while closed. That is what lets it print at any time.
    expect(within(dialog).getByRole('heading', { level: 2, name: resume.name, hidden: true })).toBeTruthy()
  })

  it('is open when state.resumeOpen is true', () => {
    const { dialog } = renderDialog({ resumeOpen: true })

    expect(dialog.open).toBe(true)
    expect(screen.getByRole('dialog', { name: `Resume ${resume.name}` })).toBe(dialog)
  })

  it('opens when OPEN_RESUME is dispatched, with focus on the name', () => {
    const { dialog } = renderDialog({ resumeOpen: false })

    fireEvent.click(screen.getByText('state says closed'))

    expect(dialog.open).toBe(true)
    expect(screen.getByText('state says open')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: resume.name }))
  })

  it('closes with the Close button', () => {
    const { dialog } = renderDialog({ resumeOpen: true })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(dialog.open).toBe(false)
    expect(screen.getByText('state says closed')).toBeTruthy()
  })

  it('closes on a click outside the sheet, but not on a click inside it', () => {
    const { dialog } = renderDialog({ resumeOpen: true })
    placeSheet(dialog)

    // Inside the sheet, on the dialog element itself (its border, for example).
    fireEvent.mouseDown(dialog, INSIDE)
    fireEvent.click(dialog, INSIDE)
    expect(dialog.open).toBe(true)

    // On the resume text.
    const summary = screen.getByText(resume.summary)
    fireEvent.mouseDown(summary, INSIDE)
    fireEvent.click(summary, INSIDE)
    expect(dialog.open).toBe(true)

    // Selecting text and letting go outside the sheet.
    fireEvent.mouseDown(summary, INSIDE)
    fireEvent.click(dialog, OUTSIDE)
    expect(dialog.open).toBe(true)

    // A press on the dimmed area that ends on something inside the sheet. A keyboard
    // "click" reports position 0,0, which is outside the box, and still must not close it.
    fireEvent.mouseDown(dialog, OUTSIDE)
    fireEvent.click(summary, { clientX: 0, clientY: 0 })
    expect(dialog.open).toBe(true)

    // A real click on the dimmed area around it.
    fireEvent.mouseDown(dialog, OUTSIDE)
    fireEvent.click(dialog, OUTSIDE)
    expect(dialog.open).toBe(false)
    expect(screen.getByText('state says closed')).toBeTruthy()
  })

  it('ignores the second click of a double-click that opened it', () => {
    // A browser numbers the clicks of a double-click: detail 1, then detail 2.
    // The first opens the sheet. The second lands on the sheet and must not undo that.
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { dialog } = renderDialog({ resumeOpen: false })
    placeSheet(dialog)

    fireEvent.click(screen.getByText('state says closed'), { detail: 1 })
    expect(dialog.open).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 2 })
    expect(dialog.open).toBe(true)

    fireEvent.mouseDown(dialog, OUTSIDE)
    fireEvent.click(dialog, { ...OUTSIDE, detail: 2 })
    expect(dialog.open).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Print resume' }), { detail: 2 })
    expect(print).not.toHaveBeenCalled()

    // fireEvent returns false when the click was cancelled, so the link is not followed.
    const [link] = within(dialog).getAllByRole('link')
    expect(fireEvent.click(link, { detail: 2 })).toBe(false)

    // The next separate click works as usual.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 1 })
    expect(dialog.open).toBe(false)
  })

  it('ignores the second click of a double-click that closed it', () => {
    // After the first click closes the sheet, the second would hit the page under it.
    // Here that is the probe button, which would open the resume again.
    const { dialog } = renderDialog({ resumeOpen: true })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 1 })
    expect(dialog.open).toBe(false)

    fireEvent.click(screen.getByText('state says closed'), { detail: 2 })
    expect(dialog.open).toBe(false)
    expect(screen.getByText('state says closed')).toBeTruthy()

    // A separate click opens it again.
    fireEvent.click(screen.getByText('state says closed'), { detail: 1 })
    expect(dialog.open).toBe(true)
  })

  it('leaves later double-clicks alone, and stops listening when removed', () => {
    const { dialog, unmount } = renderDialog({ resumeOpen: true })

    // One separate click ends the guard that began when the sheet opened.
    fireEvent.click(screen.getByText(resume.summary), { detail: 1 })
    expect(fireEvent.click(screen.getByText(resume.summary), { detail: 2 })).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 2 })
    expect(dialog.open).toBe(false)

    // The guard is on again after closing. Once the dialog is gone it must not linger.
    unmount()
    const elsewhere = document.body.appendChild(document.createElement('button'))
    expect(fireEvent.click(elsewhere, { detail: 2 })).toBe(true)
    elsewhere.remove()
  })

  it('tells the state when the browser closes the dialog (the Escape key)', () => {
    const { dialog } = renderDialog({ resumeOpen: true })

    // A browser closes the dialog by itself on Escape and then fires "close".
    dialog.removeAttribute('open')
    fireEvent(dialog, new Event('close'))

    expect(screen.getByText('state says closed')).toBeTruthy()
    expect(dialog.open).toBe(false)
  })

  it('ignores a late "close" event when the sheet is open again', () => {
    const { dialog } = renderDialog({ resumeOpen: true })

    // The event from an earlier close can arrive after the sheet was reopened.
    fireEvent(dialog, new Event('close'))

    expect(dialog.open).toBe(true)
    expect(screen.getByText('state says open')).toBeTruthy()
  })

  it('prints when Print resume is clicked', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderDialog({ resumeOpen: true })

    fireEvent.click(screen.getByRole('button', { name: 'Print resume' }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('links to LinkedIn and shows no PDF link while no public PDF is set', () => {
    const { dialog } = renderDialog({ resumeOpen: true })

    expect(resume.publicPdf).toBeNull()
    const links = within(dialog).getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('href')).toBe(identity.linkedInUrl)
    expect(dialog.querySelector('[download]')).toBeNull()
    expect(dialog.textContent).not.toMatch(/pdf/i)
    // Nothing waits in a disabled state either.
    expect(dialog.querySelector('[disabled], [aria-disabled="true"]')).toBeNull()
  })

  it('shows the PDF link once a public PDF is set in the content', () => {
    resume.publicPdf = { href: '/Annika-Dasani-Resume.pdf', label: 'Download PDF' }
    try {
      renderDialog({ resumeOpen: true })
      const download = screen.getByRole('link', { name: 'Download PDF' })
      expect(download.getAttribute('href')).toBe('/Annika-Dasani-Resume.pdf')
      expect(download.hasAttribute('download')).toBe(true)
    } finally {
      resume.publicPdf = null
    }
  })

  describe('in a browser with built-in dialogs', () => {
    // jsdom has no showModal() or close(). These stand in for the real ones:
    // close() hides the dialog and then fires "close", exactly as a browser does.
    const prototype = HTMLDialogElement.prototype as { showModal?: () => void; close?: () => void }

    afterEach(() => {
      delete prototype.showModal
      delete prototype.close
    })

    function installBuiltIns() {
      const showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      })
      const close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      })
      prototype.showModal = showModal
      prototype.close = close
      return { showModal, close }
    }

    it('opens with showModal() and closes with close()', () => {
      const { showModal, close } = installBuiltIns()
      const { dialog } = renderDialog({ resumeOpen: true })

      expect(showModal).toHaveBeenCalledTimes(1)
      expect(dialog.open).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(close).toHaveBeenCalledTimes(1)
      expect(dialog.open).toBe(false)
      expect(screen.getByText('state says closed')).toBeTruthy()

      // It can be opened again afterwards.
      fireEvent.click(screen.getByText('state says closed'))
      expect(showModal).toHaveBeenCalledTimes(2)
      expect(dialog.open).toBe(true)
    })
  })
})
