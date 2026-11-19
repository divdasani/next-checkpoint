import { describe, expect, it } from 'vitest'
import { COMPANY_COUNT, MISSION_IDS, READINESS_IDS, SOURCE_IDS, type MissionId } from '../state/types.ts'
import { content, missionContent } from './content.ts'
import { renderStaticResume } from './resumeHtml.ts'

// The safety net for the words on the site. It checks three things:
//  1. The "Real experience" cards say exactly what the brief says.
//  2. Nothing private ships: no phone number, no email address, no source resume file.
//  3. The wording stays honest: the gaming project is a concept, the dollar figures are
//     billing scope and revenue accommodated, and nothing suggests a job or offer at Roblox.
// When a check fails after an edit to content.ts, the edit is what needs a second look.

// Every piece of text in the content file ------------------------------------------

/** Walk the content object and gather every string. Functions are listed, not called. */
function gather(value: unknown, path = 'content', strings: string[] = [], functions: string[] = []) {
  if (typeof value === 'string') strings.push(value)
  else if (typeof value === 'function') functions.push(path)
  else if (Array.isArray(value)) value.forEach((item, index) => gather(item, `${path}[${index}]`, strings, functions))
  else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) gather(inner, `${path}.${key}`, strings, functions)
  }
  return { strings, functions }
}

const gathered = gather(content)
const sourceLabels = SOURCE_IDS.map((id) => content.missions.signal.sources[id])
const readinessLabels = READINESS_IDS.map((id) => content.missions.launch.readiness[id])

/** The few lines that are built by small functions, run with every input the site can give them. */
const builtText = [
  ...[0, 1, 2, 3].map((done) => content.overview.progress(done)),
  ...Array.from({ length: COMPANY_COUNT + 1 }, (_, connected) => content.missions.network.progress(connected)),
  content.missions.signal.blocked(sourceLabels),
  ...sourceLabels.map((label) => content.missions.signal.nextAction(label)),
  content.missions.launch.blocked(readinessLabels),
  ...readinessLabels.map((label) => content.missions.launch.nextAction(label)),
]

const ALL_TEXT = [...gathered.strings, ...builtText]
const sentences = (texts: readonly string[]) => texts.flatMap((text) => text.split(/(?<=[.!?;])\s+/))
const ALL_SENTENCES = sentences(ALL_TEXT)

/** The career claims: the evidence cards, the finale, and the whole resume. */
const FACTUAL_TEXT = [
  ...MISSION_IDS.flatMap((id) => [missionContent(id).evidence.quote, missionContent(id).evidence.note]),
  ...gather(content.finale).strings,
  ...gather(content.resume).strings,
]

const resumeEntries = content.resume.sections.flatMap((section) => section.entries)
const entryFor = (org: string) => resumeEntries.find((entry) => entry.org === org)

// 1. The cards ---------------------------------------------------------------------

// Copied character for character from brief/01-build-brief.md.
const BRIEF_EVIDENCE: Record<MissionId, { title: string; quote: string; labels: [string, string] }> = {
  network: {
    title: 'Eight Worlds, One System',
    quote:
      'At Microsoft, I built a framework to centralize $700M in acquisition billing across eight companies. It enabled an additional $360M in revenue to be absorbed within three months.',
    labels: ['Scalable processes', 'Cross-functional execution'],
  },
  signal: {
    title: 'Find the Signal',
    quote:
      'I interviewed users to understand reporting needs, then designed a self-service Power BI dashboard across eight acquired companies. It eliminated approximately six hours of weekly manual reporting.',
    labels: ['User discovery', 'Analytics'],
  },
  launch: {
    title: 'Launch Day',
    quote:
      'I translated business needs into engineering requirements and acceptance criteria, and coordinated roadmaps, dependencies, testing, and communications for two global tax-rate change rollouts.',
    labels: ['Acceptance criteria', 'Launch execution'],
  },
}

describe('the three missions and their Real experience cards', () => {
  it.each(MISSION_IDS)('%s: the card quote matches the brief exactly', (id) => {
    expect(content.missions[id].evidence.quote).toBe(BRIEF_EVIDENCE[id].quote)
  })

  it.each(MISSION_IDS)('%s: exactly the two supporting labels from the brief', (id) => {
    expect(content.missions[id].evidence.labels).toEqual(BRIEF_EVIDENCE[id].labels)
    expect(content.missions[id].evidence.labels).toHaveLength(2)
  })

  it.each(MISSION_IDS)('%s: the mission keeps its title from the brief', (id) => {
    expect(content.missions[id].title).toBe(BRIEF_EVIDENCE[id].title)
  })

  it('the cards are labeled "Real experience"', () => {
    expect(content.cardLabels.realExperience).toBe('Real experience')
  })

  it('missions are numbered 1 to 3 in play order, and missionContent finds each by id', () => {
    expect(MISSION_IDS.map((id) => missionContent(id).number)).toEqual([1, 2, 3])
    for (const id of MISSION_IDS) {
      expect(missionContent(id)).toBe(content.missions[id])
      expect(missionContent(id).id).toBe(id)
    }
  })

  it('every mission says in plain words that the mini-game is an illustration', () => {
    for (const id of MISSION_IDS) {
      expect(missionContent(id).illustrationNote, id).toMatch(/illustration|represent/i)
      expect(missionContent(id).objective.length, id).toBeGreaterThan(0)
    }
  })

  it('mission one uses eight generic company labels, not real or invented company names', () => {
    const labels = content.missions.network.companyLabels
    expect(labels).toHaveLength(COMPANY_COUNT)
    expect(new Set(labels).size).toBe(COMPANY_COUNT)
    // One shared generic word followed by a single letter or digit: "Company A" to "Company H".
    for (const label of labels) expect(label).toMatch(/^[A-Z][a-z]+ [A-Z0-9]$/)
    expect(new Set(labels.map((label) => label.split(' ')[0])).size).toBe(1)
  })

  it('mission two names the three data sources from the brief', () => {
    expect(SOURCE_IDS.map((id) => content.missions.signal.sources[id])).toEqual([
      'Revenue',
      'Invoice volume',
      'Customer inquiries',
    ])
    expect(Object.keys(content.missions.signal.sources).sort()).toEqual([...SOURCE_IDS].sort())
  })

  it('mission three names the three readiness checks from the brief', () => {
    expect(READINESS_IDS.map((id) => content.missions.launch.readiness[id])).toEqual([
      'Requirements',
      'User acceptance testing',
      'Communications',
    ])
    expect(Object.keys(content.missions.launch.readiness).sort()).toEqual([...READINESS_IDS].sort())
  })

  it('a "something is missing" message names exactly the missing steps and the next one', () => {
    const { signal, launch } = content.missions
    const feedHint = signal.blocked([sourceLabels[0], sourceLabels[2]])
    expect(feedHint).toContain(sourceLabels[0])
    expect(feedHint).toContain(sourceLabels[2])
    expect(feedHint).not.toContain(sourceLabels[1])
    expect(signal.nextAction(sourceLabels[1])).toContain(sourceLabels[1])

    const launchHint = launch.blocked([readinessLabels[1]])
    expect(launchHint).toContain(readinessLabels[1])
    expect(launchHint).not.toContain(readinessLabels[0])
    expect(launchHint).not.toContain(readinessLabels[2])
    expect(launch.nextAction(readinessLabels[2])).toContain(readinessLabels[2])
  })

  it('progress lines report the number they are given', () => {
    expect(content.overview.progress(2)).toContain('2')
    expect(content.missions.network.progress(5)).toContain('5')
  })
})

describe('title, opening actions, and ending', () => {
  it('is titled Next Checkpoint and offers Start playing, Guided tour, and Read resume', () => {
    expect(content.intro.title).toBe('Next Checkpoint')
    expect(content.intro.startLabel).toBe('Start playing')
    expect(content.intro.tourLabel).toBe('Guided tour')
    expect(content.intro.resumeLabel).toBe('Read resume')
  })

  it('ends on "Next checkpoint: Roblox." with Resume, LinkedIn, and Replay actions', () => {
    expect(content.finale.heading).toBe('Next checkpoint: Roblox.')
    expect(content.finale.resumeLabel).toMatch(/resume/i)
    expect(content.finale.linkedInLabel).toBe('LinkedIn')
    expect(content.finale.replayLabel).toBe('Replay')
  })

  it('carries a credit that says the site is independent and not affiliated with Roblox', () => {
    expect(content.credit.line).toMatch(/independent/i)
    expect(content.credit.line).toMatch(/not affiliated/i)
  })
})

// 2. Privacy -----------------------------------------------------------------------

// The patterns and the made-up examples below are put together from pieces, so that this
// file (which is scanned too) never contains anything that itself looks like a phone
// number or an email address.
const DIGIT = '\\d'
const GAP = '[\\s.\\-]'
const AT = '@'
// A run of digits only counts when it stands alone. These two pieces rule out digits that
// belong to something longer: a decimal, a hex color, an id, a sum.
const NOT_AFTER_MORE = '(?<![\\w.+*/#=\\-])'
const NOT_BEFORE_MORE = '(?!\\w)(?![.+*/#=\\-]\\w)'

const PRIVATE_PATTERNS: [what: string, pattern: RegExp][] = [
  [
    // Three digits, three digits, four digits, the usual ways a number is written,
    // with or without a country code or brackets around the area code.
    'a phone number',
    new RegExp(
      [
        NOT_AFTER_MORE,
        `(?:\\+?1${GAP}?)?`, // optional country code
        `(?:\\(${DIGIT}{3}\\)\\s?|${DIGIT}{3}${GAP})`, // area code, with or without brackets
        `${DIGIT}{3}${GAP}${DIGIT}{4}`,
        NOT_BEFORE_MORE,
      ].join(''),
      'g',
    ),
  ],
  // Ten or eleven digits in one run, optionally after a plus sign.
  ['a phone number without separators', new RegExp(`${NOT_AFTER_MORE}\\+?${DIGIT}{10,11}${NOT_BEFORE_MORE}`, 'g')],
  // A link that dials: the scheme followed by a number. (The bare scheme name inside
  // another test's own "must not contain" check is not a link.)
  ['a telephone link', new RegExp(`(?<![a-z])${'tel'}:\\s*[+(\\d]`, 'gi')],
  ['an email address', new RegExp(`[\\w.%+\\-]+${AT}[a-z0-9\\-]+(?:\\.[a-z0-9\\-]+)*\\.[a-z]{2,}`, 'gi')],
  // A link that opens the mail program: the scheme followed by an address.
  ['a mail link', new RegExp(`(?<![a-z])${'mailto'}:\\s*[\\w%]`, 'gi')],
]

/**
 * Every place a private-looking pattern appears, as "file:line: what".
 * The matched text itself is left out on purpose, so a real number never ends up in a test log.
 */
function privateFindings(files: Record<string, string>): string[] {
  const findings: string[] = []
  for (const [path, text] of Object.entries(files)) {
    for (const [what, pattern] of PRIVATE_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split('\n').length
        findings.push(`${path}:${line}: looks like ${what}`)
      }
    }
  }
  return findings
}

// Everything that ships: all source and style files, the page itself, and every text
// file in public/. Vite only lists the files here; nothing
// is loaded. It leaves a file out of its own listing, so this test file is added by hand.
const THIS_FILE = '/src/content/content.test.ts'
const listedFiles = Object.keys(
  import.meta.glob([
    '/src/**/*.{ts,tsx,css}',
    '/index.html',
    '/public/**/*.{svg,txt,html,json,webmanifest}',
  ]),
)

// Node then reads each file from disk as plain text. Importing the files as text would be
// shorter, but the test runner hands back an empty string for every imported .css file,
// and the style files would go unscanned without anyone noticing.
const nodeModule = async <Module>(name: string) => (await import(/* @vite-ignore */ name)) as Module
const { readFileSync } = await nodeModule<{ readFileSync: (file: string, encoding: 'utf8') => string }>('node:fs')
const { fileURLToPath } = await nodeModule<{ fileURLToPath: (url: string) => string }>('node:url')
/** The app folder on disk: the path of this file with its own "/src/content/..." part cut off. */
const appFolder = fileURLToPath(import.meta.url).slice(0, -THIS_FILE.length)

const shippedFiles: Record<string, string> = Object.fromEntries(
  [...listedFiles, THIS_FILE].map((path) => [path, readFileSync(appFolder + path, 'utf8')]),
)

// Files that are not text. Only their names matter here.
const publicDocuments = import.meta.glob('/public/**/*.{pdf,doc,docx,PDF,DOC,DOCX}')
const bundledBinaries = import.meta.glob([
  '/src/**/*.{png,jpg,jpeg,webp,gif,pdf,doc,docx}',
  '/public/**/*.{png,jpg,jpeg,webp,gif,pdf,doc,docx}',
])

describe('privacy: nothing personal ships', () => {
  it('the scan really reads the source, style, page, and public files', () => {
    const paths = Object.keys(shippedFiles)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/src/content/content.ts',
        '/src/state/reducer.ts',
        '/src/main.tsx',
        '/src/styles/base.css',
        '/index.html',
        '/public/favicon.svg',
        THIS_FILE,
      ]),
    )
    expect(paths.length).toBeGreaterThan(40)
    // Spot checks that real text came back, not empty placeholders.
    expect(shippedFiles['/src/content/content.ts']).toContain(content.identity.linkedInUrl)
    expect(shippedFiles['/src/styles/base.css']).toContain('.btn')
    expect(shippedFiles['/index.html']).toContain('<div id="root">')
    expect(shippedFiles['/public/favicon.svg']).toContain('<svg')
    expect(shippedFiles[THIS_FILE]).toContain('function privateFindings')
  })

  it('the patterns catch phone numbers and email addresses in their usual forms', () => {
    // Made-up examples, assembled here so they never appear in this file as text.
    const [area, exchange, line] = ['555', '010', '0142']
    const phoneLike = [
      `${area}-${exchange}-${line}`,
      `${area}.${exchange}.${line}`,
      `${area} ${exchange} ${line}`,
      `(${area}) ${exchange}-${line}`,
      `(${area})${exchange}-${line}`,
      `+1 ${area} ${exchange} ${line}`,
      `1-${area}-${exchange}-${line}`,
      `${area}${exchange}${line}`,
      `+1${area}${exchange}${line}`,
      `<a href="${'tel'}:${area}${exchange}${line}">Call</a>`,
    ]
    const emailLike = [
      ['someone', 'example.com'].join(AT),
      ['first.last+jobs', 'mail.example.co.uk'].join(AT),
      `<a href="${'mailto'}:hello">Write</a>`,
    ]
    for (const sample of [...phoneLike, ...emailLike]) {
      expect(privateFindings({ sample: `Contact: ${sample}.` }), sample).not.toEqual([])
      expect(privateFindings({ sample }), sample).not.toEqual([])
    }
  })

  it('the patterns leave ordinary code, styles, and resume wording alone', () => {
    const harmless = [
      'canvas 1440x900, 1920x1080, 390x844',
      'color: #1b2a4a; background: rgb(255 255 255);',
      'on 2026-11-18 with three 0.182.0',
      'Mar 2022 to Jul 2025, $700M and $360M, 30+ acquisitions, 60-person 2021 Co-Op',
      "import { useFrame } from '@react-three/fiber'",
      '@media (min-width: 480px) { :root { --pin-reach: 2.375rem; } }',
      '<path d="M32 40 54 51 32 62 10 51Z" fill="#66cf6f"/>',
      'at: 50_510, holds: [4000, 9000, 6500]',
      'https://www.linkedin.com/in/annikadasani/',
      'hotel: 2 nights',
      // Other tests name the link schemes in their own "must not contain" checks.
      'expect(html).not.toMatch(/mailto:|tel:/i)',
      'a[href^="mailto:"], a[href^="tel:"]',
    ]
    for (const sample of harmless) expect(privateFindings({ sample }), sample).toEqual([])
  })

  it('no shipped file contains a phone number or an email address', () => {
    expect(privateFindings(shippedFiles)).toEqual([])
  })

  it('the resume built for visitors without JavaScript contains none either', () => {
    const html = renderStaticResume(content)
    expect(html).toContain(content.identity.name)
    expect(privateFindings({ 'static resume': html })).toEqual([])
  })

  it('the content text itself contains none', () => {
    expect(privateFindings({ content: ALL_TEXT.join('\n') })).toEqual([])
  })

  it('no resume document sits in public/ (the source PDF and DOCX hold contact details)', () => {
    const approved = content.resume.publicPdf ? [`/public${content.resume.publicPdf.href}`] : []
    expect(Object.keys(publicDocuments)).toEqual(approved)
    expect(Object.keys(publicDocuments).filter((path) => /\.docx?$/i.test(path))).toEqual([])
  })

  it('no source resume or reference image has been copied into the app', () => {
    const sourceNames = /annika_dasani|fancade|sokocat|mekorama|kenney/i
    expect(Object.keys(bundledBinaries).filter((path) => sourceNames.test(path))).toEqual([])
  })

  it('offers no PDF download: Annika has not approved a public PDF', () => {
    // When she does approve one, follow the note next to publicPdf in content.ts and then
    // change this expectation. Until then the button must not exist.
    expect(content.resume.publicPdf).toBeNull()
  })

  it('uses LinkedIn, and only LinkedIn, as the public contact', () => {
    expect(content.identity.linkedInUrl).toBe('https://www.linkedin.com/in/annikadasani/')
    expect(content.identity.linkedInUrl).toContain(content.identity.linkedInLabel)
    expect(content.resume.contactNote).toMatch(/LinkedIn/)

    // The only web addresses in the content are LinkedIn and the role she is applying for.
    const allowed = [content.identity.linkedInUrl, 'https://careers.roblox.com/jobs/8143976']
    const addresses = ALL_TEXT.flatMap((text) => text.match(/https?:\/\/[^\s"')]+/g) ?? [])
    for (const address of addresses) expect(allowed).toContain(address)
  })
})

// 3. Honest wording ----------------------------------------------------------------

/** Every sentence in the content that matches a pattern. Used to say "none of these may exist". */
function sentencesWith(pattern: RegExp, from: readonly string[] = ALL_SENTENCES): string[] {
  return from.filter((sentence) => pattern.test(sentence))
}

describe('honest wording', () => {
  it('this test reads every text-building function in the content file', () => {
    // If a new function is added to content.ts, add its output to builtText above,
    // so the wording checks below read it too.
    expect([...gathered.functions].sort()).toEqual(
      [
        'content.overview.progress',
        'content.missions.network.progress',
        'content.missions.signal.blocked',
        'content.missions.signal.nextAction',
        'content.missions.launch.blocked',
        'content.missions.launch.nextAction',
      ].sort(),
    )
    expect(ALL_TEXT.length).toBeGreaterThan(60)
  })

  describe('the gaming project was a concept and a pitch, never a built app', () => {
    it('the finale calls it a concept that was pitched', () => {
      expect(content.finale.gaming).toMatch(/\bconcept\b/i)
      expect(content.finale.gaming).toMatch(/\bpitch/i)
    })

    it('the resume calls it a concept, in the summary and under 3 Day Startup', () => {
      expect(content.resume.summary).toMatch(/\bconcept\b/i)
      const bullets = entryFor('3 Day Startup')?.bullets ?? []
      const gamingBullets = bullets.filter((bullet) => /gaming|players/i.test(bullet))
      expect(gamingBullets.length).toBeGreaterThan(0)
      for (const bullet of gamingBullets) expect(bullet).toMatch(/\bconcept\b/i)
    })

    it('wherever the word "app" or "gaming" appears, the same sentence says "concept"', () => {
      const mentions = sentencesWith(/\bapps?\b|\bgaming\b/i)
      expect(mentions.length).toBeGreaterThanOrEqual(3)
      for (const sentence of mentions) expect(sentence).toMatch(/\bconcept\b/i)
    })

    const AN_APP = '(?:an|the|my|our|her) app\\b'
    it.each([
      ['shipped', /\bshipp(?:ed|ing)\b/i],
      ['launched an app', new RegExp(`\\blaunch(?:ed|ing)? ${AN_APP}`, 'i')],
      ['built an app', new RegExp(`\\b(?:built|building|coded|made|created|released|published|tested) ${AN_APP}`, 'i')],
      ['developed an app (without "concept")', new RegExp(`\\bdevelop(?:ed|ing)? ${AN_APP}(?! concept)`, 'i')],
      ['users of the app', /\busers of the app\b|\bapp users\b|\bthe app's users\b/i],
      ['an app store or downloads', /\bapp store\b|\bdownloads\b|\binstalls\b/i],
    ])('never says: %s', (_phrase, pattern) => {
      expect(sentencesWith(pattern)).toEqual([])
    })
  })

  describe('the dollar figures are billing scope and revenue accommodated, not revenue generated', () => {
    it('the only dollar amounts anywhere are $700M and $360M', () => {
      const amount = /\$\s?[\d.,]+\s?(?:[MBK]\b|million|billion|thousand)?/gi
      const amounts = ALL_TEXT.flatMap((text) => text.match(amount) ?? [])
      expect(amounts.length).toBeGreaterThan(0)
      expect([...new Set(amounts)].sort()).toEqual(['$360M', '$700M'])
    })

    it('every sentence with $700M describes it as billing', () => {
      const mentions = sentencesWith(/\$700M/)
      expect(mentions.length).toBeGreaterThanOrEqual(2)
      for (const sentence of mentions) expect(sentence).toMatch(/\bbilling\b/i)
    })

    it('every sentence with $360M says it was absorbed or accommodated', () => {
      const mentions = sentencesWith(/\$360M/)
      expect(mentions.length).toBeGreaterThanOrEqual(2)
      for (const sentence of mentions) expect(sentence).toMatch(/\babsorbed\b|\baccommodated\b/i)
    })

    it('the word "generated" only appears where the text says the figures were not generated', () => {
      for (const sentence of sentencesWith(/generat/i)) {
        expect(sentence).toMatch(/\b(?:neither|not|never|nor)\b/i)
      }
    })

    // "generated $...", "earned over $...", and so on: a verb, an optional filler, then a dollar sign.
    const DOLLARS = '(?:an additional |over |more than |nearly )?\\$'
    it.each([
      [
        'revenue generated',
        new RegExp(`\\bgenerat\\w* ${DOLLARS}|\\brevenue (?:was |she |that was )?generated\\b`, 'i'),
      ],
      [
        'money earned, driven, or brought in',
        new RegExp(`\\b(?:earned|drove|driving|brought in|delivered|won|grew|increased|boosted) ${DOLLARS}`, 'i'),
      ],
      ['money personally processed or managed', new RegExp(`\\b(?:processed|handled|managed) ${DOLLARS}`, 'i')],
      ['revenue growth', /\brevenue growth\b|\b(?:grew|increased|boosted) revenue\b|\bin sales\b/i],
    ])('never claims: %s', (_claim, pattern) => {
      expect(sentencesWith(pattern)).toEqual([])
    })
  })

  describe('no offer and no job at Roblox is implied', () => {
    it('she is described as an applicant, and the finale says she is applying', () => {
      expect(content.identity.role).toBe('Associate Product Manager applicant')
      expect(content.finale.applying).toMatch(/\bapplying\b/i)
    })

    it('every sentence that names Roblox makes the relationship clear', () => {
      // Allowed: the ending line from the brief, wording about applying, the independence
      // credit, and "Roblox-inspired". A new sentence about Roblox needs one of these too,
      // or a deliberate change to this list.
      const clear = [
        /^Next checkpoint: Roblox\.$/,
        /\bapply(?:ing)?\b|\bapplicant\b|\bapplication\b/i,
        /\bnot affiliated\b|\bnot endorsed\b|\bindependent\b|\bunofficial\b/i,
        /\bRoblox-inspired\b/i,
      ]
      const mentions = sentencesWith(/roblox/i)
      expect(mentions.length).toBeGreaterThanOrEqual(3)
      for (const sentence of mentions) {
        expect(clear.some((pattern) => pattern.test(sentence)), sentence).toBe(true)
      }
    })

    it.each([
      ['Roblox employee', /\broblox employee\b|\bemployee (?:of|at) roblox\b|\broblox staff\b/i],
      ['working at Roblox', /\b(?:work|works|worked|working|job|role|position|building|team) (?:at|with) roblox\b/i],
      [
        'joining or hired by Roblox',
        /\b(?:join|joins|joined|joining|hired by|recruited by) roblox\b|\broblox (?:hired|recruited|offered)\b/i,
      ],
      ['a job offer', /\b(?:an|the|my|a|job) offer\b|\boffer (?:from|letter)\b|\boffered (?:me|a|the)\b/i],
      ['an accepted role', /\baccepted (?:an|the|my|a)\b|\bsigned (?:with|on)\b|\bstart(?:ing)? at roblox\b/i],
      ['an official Roblox page', /\bofficial roblox\b|\broblox careers\b|\broblox recruiting\b/i],
    ])('never says: %s', (_phrase, pattern) => {
      expect(sentencesWith(pattern)).toEqual([])
    })
  })

  describe('nothing claims Annika built, coded, or user-tested this site', () => {
    const MADE = '(?:built|coded|programmed|developed|engineered|designed|made|created)'
    const THIS_SITE = '(?:this|the) (?:site|website|page|world|game|experience|interactive resume)'
    it.each([
      ['built this site', new RegExp(`\\b${MADE} ${THIS_SITE}\\b`, 'i')],
      ['made by Annika', new RegExp(`\\b${MADE} by (?:annika|me)\\b`, 'i')],
      ['user-tested', /\buser[- ]tested\b|\bplay[- ]?tested\b|\btested with (?:users|players|visitors)\b/i],
    ])('never says: %s', (_phrase, pattern) => {
      expect(sentencesWith(pattern)).toEqual([])
    })
  })

  describe('no invented results or skills', () => {
    it.each([
      ['machine learning or an LLM', /\bmachine learning\b|\bML\b|\bLLMs?\b|\bAI\b|\bartificial intelligence\b/],
      ['A/B tests', /\bA\/B\b|\bsplit test/i],
      ['retention or engagement results', /\bretention\b|\bengagement (?:rate|lift)\b|\bconversion\b/i],
      ['testimonials', /\btestimonial|\bquote from\b/i],
      ['percentages', /\d\s?%|\bpercent\b/i],
      ['user counts', /\b\d[\d,.]*\+?\s*(?:k\s+)?(?:users|players|customers|visitors|downloads)\b/i],
    ])('never mentions: %s', (_claim, pattern) => {
      expect(sentencesWith(pattern)).toEqual([])
    })

    it('every number in the career claims is one of the confirmed figures', () => {
      // From brief/02-resume-facts.md: $700M, $360M, 8 companies and inboxes, 6 hours, 2 rollouts,
      // 30+ acquisitions, 3 acquisitions and 2 divestitures, 3 months, 3+ years, 3 Day Startup,
      // 40 participants, the 60-person program, and the years 2019 to 2025.
      const amounts = ['2', '3', '6', '8', '30', '40', '60', '360', '700']
      const years = ['2019', '2020', '2021', '2022', '2025']
      const confirmed = new Set([...amounts, ...years])
      const numbers = FACTUAL_TEXT.flatMap((text) => text.match(/\d+(?:[.,]\d+)*/g) ?? [])
      expect(numbers.length).toBeGreaterThan(10)
      expect(numbers.filter((number) => !confirmed.has(number))).toEqual([])
    })

    it('the skills are the ones on the source resume', () => {
      const sourceSkills = [
        'User Research',
        'Requirements Definition',
        'Acceptance Criteria',
        'Success Metrics',
        'Pilot Evaluation',
        'SQL',
        'Power BI',
        'Excel',
        'Power Automate',
        'Roadmap Planning',
        'User Acceptance Testing',
        'Go-to-Market Execution',
      ]
      expect(content.resume.skills.length).toBeGreaterThan(0)
      for (const skill of content.resume.skills) expect(sourceSkills).toContain(skill)
    })
  })
})

describe('the resume matches the confirmed facts', () => {
  it('is for Annika Dasani, Associate Product Manager applicant', () => {
    expect(content.identity.name).toBe('Annika Dasani')
    expect(content.resume.name).toBe('Annika Dasani')
    expect(content.resume.headline).toBe(content.identity.role)
  })

  it('lists exactly the three confirmed organisations', () => {
    expect(resumeEntries.map((entry) => entry.org).sort()).toEqual(
      ['3 Day Startup', 'Mercedes-Benz U.S. International', 'Microsoft'].sort(),
    )
  })

  it('Microsoft: Business Operations Program Manager, Mergers & Acquisitions, March 2022 to July 2025, Redmond', () => {
    const entry = entryFor('Microsoft')
    expect(entry?.role).toMatch(/^Business Operations Program Manager\b/)
    expect(entry?.role).toMatch(/Mergers & Acquisitions/)
    expect(entry?.dates).toMatch(/Mar\w* 2022/)
    expect(entry?.dates).toMatch(/Jul\w* 2025/)
    expect(entry?.location).toMatch(/Redmond/)
  })

  it('3 Day Startup: Participant and Mentor, April 2019 to December 2020, College Station', () => {
    const entry = entryFor('3 Day Startup')
    expect(entry?.role).toBe('Participant and Mentor')
    expect(entry?.dates).toMatch(/Apr\w* 2019/)
    expect(entry?.dates).toMatch(/Dec\w* 2020/)
    expect(entry?.location).toMatch(/College Station/)
    expect(entry?.bullets.join(' ')).toMatch(/placed second/i)
  })

  it('Mercedes-Benz U.S. International: Human Resources Intern, August to December 2020, Vance', () => {
    const entry = entryFor('Mercedes-Benz U.S. International')
    expect(entry?.role).toBe('Human Resources Intern')
    expect(entry?.dates).toMatch(/Aug\w* 2020/)
    expect(entry?.dates).toMatch(/Dec\w* 2020/)
    expect(entry?.location).toMatch(/Vance/)
  })

  it('education: Texas A&M, Mays Business School, BBA in Supply Chain Management, December 2021', () => {
    const { education } = content.resume
    expect(education.school).toBe('Texas A&M University, Mays Business School')
    expect(education.degree).toBe('Bachelor of Business Administration in Supply Chain Management')
    expect(education.date).toMatch(/Dec\w* 2021/)
  })

  it('keeps the confirmed pilot and success-metric experience, without attaching results to it', () => {
    const bullets = entryFor('Microsoft')?.bullets ?? []
    const pilot = bullets.filter((bullet) => /\bpilots?\b/i.test(bullet))
    expect(pilot).toHaveLength(1)
    expect(pilot[0]).toMatch(/success metrics/i)
    // No interview counts, sample sizes, or outcomes have been supplied for this work.
    expect(pilot[0]).not.toMatch(/\d/)
  })

  it('every resume entry has a role, dates, and at least one bullet', () => {
    expect(resumeEntries.length).toBeGreaterThan(0)
    for (const entry of resumeEntries) {
      expect(entry.role.length, entry.org).toBeGreaterThan(0)
      expect(entry.dates.length, entry.org).toBeGreaterThan(0)
      expect(entry.bullets.length, entry.org).toBeGreaterThan(0)
    }
  })
})
