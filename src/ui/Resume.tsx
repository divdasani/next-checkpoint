import { content } from '../content/content.ts'
import { RESUME_LABELS } from '../content/resumeHtml.ts'

// The readable resume as ordinary HTML: a name, a few headed sections, and lists.
// Every word comes from content.ts (content.resume and content.identity), so editing the
// resume means editing that file, not this one. LinkedIn is the only contact shown.
//
// This component only arranges the text. It reads no game state and has no buttons of
// its own. ResumeDialog.tsx shows it on screen, resume.css styles it there, and print.css
// styles it on paper.
//
// content/resumeHtml.ts writes the same structure as plain text for visitors without
// JavaScript. A test compares the two, so a change to the structure here must be made
// there as well.

interface EntryHeadProps {
  org: string
  role: string
  location: string
  dates: string
}

/** The top lines of an entry: who and what on one side, where and when on the other. */
function EntryHead({ org, role, location, dates }: EntryHeadProps) {
  return (
    <div className="resume__entry-head">
      <div className="resume__entry-title">
        <h4 className="resume__org">{org}</h4>
        <p className="resume__role">{role}</p>
      </div>
      {/* The dot separates place and dates when they share a line. Screen readers skip it. */}
      <p className="resume__meta">
        <span className="resume__location">{location}</span>{' '}
        <span className="resume__meta-dot" aria-hidden="true">
          ·
        </span>{' '}
        <span className="resume__dates">{dates}</span>
      </p>
    </div>
  )
}

interface ResumeProps {
  /** The id given to the name heading, so whatever shows the resume can use the name as its label. */
  headingId: string
}

export function Resume({ headingId }: ResumeProps) {
  const { identity, resume } = content
  const { education } = resume

  return (
    <article className="resume" aria-labelledby={headingId}>
      <header className="resume__header">
        {/* tabIndex -1 lets the dialog place keyboard focus here when it opens. Tab still skips it. */}
        <h2 id={headingId} className="resume__name" tabIndex={-1}>
          {resume.name}
        </h2>
        <p className="resume__headline">{resume.headline}</p>
        <p className="resume__contact">
          <span className="resume__contact-note">{resume.contactNote}</span>{' '}
          <a className="resume__link" href={identity.linkedInUrl} target="_blank" rel="noopener noreferrer">
            {identity.linkedInLabel}
            <span className="visually-hidden">{` ${RESUME_LABELS.newTab}`}</span>
          </a>
        </p>
      </header>

      <section className="resume__section">
        <h3 className="resume__heading">{RESUME_LABELS.summary}</h3>
        <div className="resume__body">
          <p className="resume__summary">{resume.summary}</p>
        </div>
      </section>

      <section className="resume__section">
        <h3 className="resume__heading">{RESUME_LABELS.skills}</h3>
        <div className="resume__body">
          {/* role="list" keeps this announced as a list in Safari, which drops that for lists without bullets. */}
          <ul className="resume__skills" role="list">
            {resume.skills.map((skill) => (
              <li key={skill} className="resume__skill">
                {skill}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Experience, projects, and any other group listed under resume.sections in content.ts. */}
      {resume.sections.map((group) => (
        <section key={group.heading} className="resume__section">
          <h3 className="resume__heading">{group.heading}</h3>
          <div className="resume__body">
            {group.entries.map((entry) => (
              <div key={`${entry.org} ${entry.dates}`} className="resume__entry">
                <EntryHead org={entry.org} role={entry.role} location={entry.location} dates={entry.dates} />
                <ul className="resume__bullets">
                  {entry.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="resume__section">
        <h3 className="resume__heading">{RESUME_LABELS.education}</h3>
        <div className="resume__body">
          <div className="resume__entry">
            <EntryHead
              org={education.school}
              role={education.degree}
              location={education.location}
              dates={education.date}
            />
          </div>
        </div>
      </section>
    </article>
  )
}
