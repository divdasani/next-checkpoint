import { describe, expect, it } from 'vitest'
import { content, type Content } from './content.ts'
import { renderStaticResume } from './resumeHtml.ts'

// What these tests protect:
//  - the copy of the resume for visitors without JavaScript carries every fact in content.ts
//  - text is escaped, so nothing in the content can turn into markup or a script
//  - no phone number or email address can slip onto the public page

/**
 * How a piece of text must look inside the HTML. Written out here on purpose,
 * so the test does not lean on the code it is checking.
 */
function escaped(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('$', '&#36;')
}

/** Reads the HTML the way a browser would, so tests can look at what a visitor sees. */
function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function texts(doc: Document, selector: string): string[] {
  return [...doc.querySelectorAll(selector)].map((element) => element.textContent ?? '')
}

const PHONE_LIKE = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/
const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[\w.]+/

const { identity, resume } = content
const html = renderStaticResume(content)
const doc = parse(html)

describe('renderStaticResume', () => {
  it('contains the name, the headline, and the LinkedIn address', () => {
    expect(html).toContain(escaped(resume.name))
    expect(html).toContain(escaped(resume.headline))
    expect(html).toContain(escaped(identity.linkedInUrl))
    expect(html).toContain(escaped(identity.linkedInLabel))

    expect(texts(doc, '.resume__name')).toEqual([resume.name])
    const link = doc.querySelector('a.resume__link')
    expect(link?.getAttribute('href')).toBe(identity.linkedInUrl)
    expect(link?.textContent).toContain(identity.linkedInLabel)
  })

  it('says why the world is missing and that the resume follows', () => {
    const notice = doc.querySelector('.resume-static__notice')?.textContent ?? ''
    expect(notice).toContain(content.intro.title)
    expect(notice).toMatch(/needs JavaScript/)
    expect(notice).toMatch(/resume is below/)
  })

  it('contains the summary and every skill', () => {
    expect(html).toContain(escaped(resume.summary))
    for (const skill of resume.skills) expect(html).toContain(escaped(skill))
    expect(texts(doc, '.resume__skill')).toEqual([...resume.skills])
  })

  it('contains every section, entry, and bullet', () => {
    for (const section of resume.sections) {
      expect(html).toContain(escaped(section.heading))
      for (const entry of section.entries) {
        for (const line of [entry.org, entry.location, entry.role, entry.dates, ...entry.bullets]) {
          expect(html).toContain(escaped(line))
        }
      }
    }

    // Read as a browser would: the bullets are all there, once each, in the same order.
    const bullets = resume.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets))
    expect(bullets.length).toBeGreaterThan(0)
    expect(texts(doc, '.resume__bullets li')).toEqual(bullets)

    const headings = texts(doc, '.resume__heading')
    for (const section of resume.sections) expect(headings).toContain(section.heading)
  })

  it('contains the education line', () => {
    const { school, degree, location, date } = resume.education
    for (const line of [school, degree, location, date]) expect(html).toContain(escaped(line))

    const education = [...doc.querySelectorAll('.resume__section')].at(-1)?.textContent ?? ''
    for (const line of [school, degree, location, date]) expect(education).toContain(line)
  })

  it('carries the independent-project credit', () => {
    expect(doc.querySelector('.resume-static__credit')?.textContent).toBe(content.credit.line)
  })

  it('escapes special characters in every piece of text', () => {
    const hostile = '<b>&"x"</b>'
    const hostileUrl = 'https://example.org/?next="><script>alert(1)</script>'
    const tricky = "it's <i>$& $1 $$</i>"

    const copy = {
      ...content,
      intro: { ...content.intro, title: hostile },
      credit: { line: hostile },
      identity: { ...content.identity, linkedInUrl: hostileUrl, linkedInLabel: hostile },
      resume: {
        ...resume,
        name: hostile,
        headline: hostile,
        summary: hostile,
        contactNote: hostile,
        skills: [hostile, tricky],
        sections: [
          {
            heading: hostile,
            entries: [{ org: hostile, location: hostile, role: hostile, dates: hostile, bullets: [hostile, tricky] }],
          },
        ],
        education: { school: hostile, location: hostile, degree: hostile, date: hostile },
        publicPdf: { href: '/a"b.pdf', label: hostile },
      },
    } as unknown as Content

    const output = renderStaticResume(copy)

    expect(output).toContain('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;')
    expect(output).not.toContain('<b>')
    expect(output).not.toContain('<i>')
    expect(output).not.toMatch(/<script/i)
    // The build inserts this text with String.replace, where "$" is special.
    expect(output).not.toContain('$')

    // A browser shows the text exactly as written and builds no extra elements from it.
    const parsed = parse(output)
    expect(parsed.querySelector('b, i, script')).toBeNull()
    expect(texts(parsed, '.resume__name')).toEqual([hostile])
    expect(texts(parsed, '.resume__skill')).toEqual([hostile, tricky])
    expect(texts(parsed, '.resume__bullets li')).toEqual([hostile, tricky])
    expect(texts(parsed, '.resume__org')).toEqual([hostile, hostile])
    expect(parsed.querySelector('a.resume__link')?.getAttribute('href')).toBe(hostileUrl)
    expect(parsed.querySelector('.resume-static__download a')?.getAttribute('href')).toBe('/a"b.pdf')
  })

  it('survives being inserted into index.html the way vite.config.ts does it', () => {
    const page = '<noscript><!--static-resume--></noscript>'.replace('<!--static-resume-->', html)
    expect(page).toBe(`<noscript>${html}</noscript>`)
    // After a browser reads it, the dollar amounts are back as written.
    expect(doc.body.textContent).toContain('$700M')
    expect(doc.body.textContent).toContain('$360M')
  })

  it('contains no script and no inline event handlers', () => {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/\son\w+\s*=/i)
    expect(html).not.toMatch(/javascript:/i)
  })

  it('contains nothing that looks like a phone number or an email address', () => {
    expect(html).not.toMatch(PHONE_LIKE)
    expect(html).not.toMatch(EMAIL_LIKE)
    expect(html).not.toMatch(/mailto:|tel:/i)
    // LinkedIn is the only place the page links to.
    const links = [...doc.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    expect(links).toEqual([identity.linkedInUrl])
  })

  it('offers a PDF only when a public PDF is set in the content', () => {
    expect(resume.publicPdf).toBeNull()
    expect(html).not.toMatch(/\.pdf/i)
    expect(doc.querySelector('[download]')).toBeNull()

    const withPdf = parse(
      renderStaticResume({
        ...content,
        resume: { ...resume, publicPdf: { href: '/Annika-Dasani-Resume.pdf', label: 'Download PDF' } },
      }),
    )
    const download = withPdf.querySelector('a[download]')
    expect(download?.getAttribute('href')).toBe('/Annika-Dasani-Resume.pdf')
    expect(download?.textContent).toBe('Download PDF')
  })
})
