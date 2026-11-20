import type { Content } from './content.ts'

// ─────────────────────────────────────────────────────────────────────────────
// The resume as one plain HTML string, for visitors whose browser has JavaScript
// switched off. vite.config.ts calls this while the site is built and puts the
// result inside <noscript> in index.html.
//
// It runs in Node at build time, so it cannot use React or anything that only
// exists in a browser. It writes the same structure and class names as
// src/ui/Resume.tsx, which is why resume.css and print.css style both copies.
// A test (src/ui/Resume.test.tsx) compares the two, so change them together.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section titles and helper words that are not career facts.
 * Resume.tsx reads the same list, so the two copies of the resume always agree.
 */
export const RESUME_LABELS = {
  summary: 'Summary',
  skills: 'Skills',
  education: 'Education',
  /** Read out by screen readers after a link that opens a new tab. */
  newTab: '(opens in a new tab)',
} as const

/** Shown above the resume when the world cannot run. */
const NEEDS_JAVASCRIPT = 'The interactive world needs JavaScript. The full resume is below.'

/** The dialog version gets the id of its name heading from React. This copy needs a fixed one. */
const NAME_ID = 'resume-static-name'

/**
 * A few styles written directly on the container, so the page is still a tidy white
 * sheet on the sky background even if the stylesheet fails to load.
 */
const CONTAINER_STYLE = [
  'box-sizing:border-box',
  'width:calc(100% - 1.5rem)',
  'max-width:51.25rem',
  'margin:0.75rem auto',
  'padding:1.5rem 1.25rem',
  'background:#fff',
].join(';')

/**
 * Makes a piece of text safe to place inside HTML, so a character such as "<" or "&"
 * in the content is shown as written instead of being read as markup.
 * The dollar sign is included as a precaution: in the replacement text of String.replace,
 * "$" followed by certain characters has a special meaning. (The build avoids that anyway
 * by passing a function.)
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\$/g, '&#36;')
}

/** One titled block of the resume: the heading, then whatever belongs under it. */
function section(heading: string, body: string): string {
  return (
    '<section class="resume__section">' +
    `<h3 class="resume__heading">${escapeHtml(heading)}</h3>` +
    `<div class="resume__body">${body}</div>` +
    '</section>'
  )
}

/**
 * The top lines of an entry: who and what on one side, where and when on the other.
 * The dot separates place and dates when they share a line. Screen readers skip it.
 */
function entryHead(org: string, role: string, location: string, dates: string): string {
  return (
    '<div class="resume__entry-head">' +
    '<div class="resume__entry-title">' +
    `<h4 class="resume__org">${escapeHtml(org)}</h4>` +
    `<p class="resume__role">${escapeHtml(role)}</p>` +
    '</div>' +
    '<p class="resume__meta">' +
    `<span class="resume__location">${escapeHtml(location)}</span> ` +
    '<span class="resume__meta-dot" aria-hidden="true">&middot;</span> ' +
    `<span class="resume__dates">${escapeHtml(dates)}</span>` +
    '</p>' +
    '</div>'
  )
}

export function renderStaticResume(content: Content): string {
  const { identity, resume } = content
  const { education, publicPdf } = resume

  const header =
    '<header class="resume__header">' +
    `<h2 id="${NAME_ID}" class="resume__name">${escapeHtml(resume.name)}</h2>` +
    `<p class="resume__headline">${escapeHtml(resume.headline)}</p>` +
    '<p class="resume__contact">' +
    `<span class="resume__contact-note">${escapeHtml(resume.contactNote)}</span> ` +
    `<a class="resume__link" href="${escapeHtml(identity.linkedInUrl)}" target="_blank" rel="noopener noreferrer">` +
    escapeHtml(identity.linkedInLabel) +
    `<span class="visually-hidden"> ${escapeHtml(RESUME_LABELS.newTab)}</span>` +
    '</a>' +
    '</p>' +
    '</header>'

  const summary = section(RESUME_LABELS.summary, `<p class="resume__summary">${escapeHtml(resume.summary)}</p>`)

  const skillItems = resume.skills.map((skill) => `<li class="resume__skill">${escapeHtml(skill)}</li>`).join('')
  const skills = section(RESUME_LABELS.skills, `<ul class="resume__skills" role="list">${skillItems}</ul>`)

  // Experience, projects, and any other group listed under resume.sections in content.ts.
  const sections = resume.sections
    .map((group) => {
      const entries = group.entries.map((entry) => {
        const bullets = entry.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')
        return (
          '<div class="resume__entry">' +
          entryHead(entry.org, entry.role, entry.location, entry.dates) +
          `<ul class="resume__bullets">${bullets}</ul>` +
          '</div>'
        )
      })
      return section(group.heading, entries.join(''))
    })
    .join('')

  const educationSection = section(
    RESUME_LABELS.education,
    '<div class="resume__entry">' +
      entryHead(education.school, education.degree, education.location, education.date) +
      '</div>',
  )

  // Only when a public PDF has been approved and set in content.ts. Otherwise nothing at all.
  const download = publicPdf
    ? '<p class="resume-static__download">' +
      `<a href="${escapeHtml(publicPdf.href)}" download>${escapeHtml(publicPdf.label)}</a>` +
      '</p>'
    : ''

  return (
    `<div class="resume-static" style="${CONTAINER_STYLE}">` +
    '<div class="resume-static__notice">' +
    `<h1 class="resume-static__title">${escapeHtml(content.intro.title)}</h1>` +
    `<p class="resume-static__note">${escapeHtml(NEEDS_JAVASCRIPT)}</p>` +
    '</div>' +
    download +
    `<article class="resume" aria-labelledby="${NAME_ID}">` +
    header +
    summary +
    skills +
    sections +
    educationSection +
    '</article>' +
    '</div>'
  )
}
