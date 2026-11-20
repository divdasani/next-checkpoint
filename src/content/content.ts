import type { DiscoveryId, MissionId, ReadinessId, SourceId } from '../state/types.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Factual content for Next Checkpoint. This is the only file that holds career
// claims, so editing the words on the site means editing this file.
//
// The site is a small trail through Annika's career: four checkpoints, each with a
// short mission, a passport stamp, and the skills that work demonstrates.
//
// Keep these distinctions when editing:
//  - $700M is acquisition-billing scope and $360M is additional revenue the
//    framework accommodated. Neither is revenue generated or personally processed.
//  - The gaming project was an app concept and a pitch. It was not built, tested,
//    or shipped.
//  - The missions are illustrations. The checkpoint cards are the facts.
//  - Roblox Trails is the product idea in Annika's application. She is an applicant,
//    and the Roblox stamp at the end of the trail stays empty.
//  - Public contact is LinkedIn only. Do not add a phone number or personal email.
// ─────────────────────────────────────────────────────────────────────────────

/** One headline result on a checkpoint card: the value is shown large, the label beside it. */
export interface Metric {
  value: string
  label: string
}

/** What a checkpoint says about the real work: the problem, the result, and the skills. */
export interface Checkpoint {
  /** Name of the checkpoint on the trail. */
  name: string
  /** The word on its passport stamp. */
  stamp: string
  /** Where the work happened. */
  source: string
  /** The problem, in one line. */
  challenge: string
  /** What Annika did, as a few short steps, where the story has them. */
  flow?: readonly string[]
  /** The partner teams that came together for the launch (Ship only). */
  teams?: readonly string[]
  /** The headline results, shown large. Read together, value then label, each is one statement. */
  metrics: readonly Metric[]
  /** One line of takeaway under the results, where the checkpoint has one. */
  theme?: string
  /** Skills this work demonstrates. They unlock together with the stamp. */
  skills: readonly string[]
}

export interface Evidence {
  /** Shown under the "Real experience" label, in Annika's words. */
  quote: string
  /** One more line of detail under the statement, where Annika wants one. */
  note?: string
}

export interface MissionContent {
  id: MissionId
  /** Position on the trail. */
  number: 1 | 2 | 3 | 4
  title: string
  /** Compact title for narrow screens. */
  shortTitle: string
  /** Name of the destination in the world. */
  place: string
  objective: string
  /** How to act, for both the 3D world and the HTML buttons. */
  how: string
  /** Status line once the mission is complete. */
  completeLine: string
  checkpoint: Checkpoint
  evidence: Evidence
}

export interface ResumeEntry {
  org: string
  location: string
  role: string
  dates: string
  bullets: readonly string[]
}

export interface ResumeSection {
  heading: string
  entries: readonly ResumeEntry[]
}

export interface PublicPdf {
  /** Path under public/, for example "/Annika-Dasani-Resume.pdf". */
  href: string
  label: string
}

const identity = {
  name: 'Annika Dasani',
  role: 'Associate Product Manager applicant',
  linkedInUrl: 'https://www.linkedin.com/in/annikadasani/',
  linkedInLabel: 'linkedin.com/in/annikadasani',
} as const

const intro = {
  title: 'Next Checkpoint',
  opening: 'Every level is a real problem I helped solve. Ready?',
  blurb:
    'A small playable resume. Follow four checkpoints, collect a passport stamp at each, and see the real work behind it.',
  startLabel: 'Start playing',
  tourLabel: 'Guided tour',
  tourNote: 'Hands-free, about 75 seconds.',
  resumeLabel: 'Read resume',
} as const

const overview = {
  heading: 'Choose a checkpoint',
  body: 'Click a building in the world or pick a checkpoint here. They are numbered as a trail, but any order works.',
  progress: (done: number) => `${done} of 4 stamps collected`,
} as const

/** The trail and its passport: the product idea the site demonstrates. */
const trail = {
  /** Who curated the trail, shown like the creator of a Trail. */
  byline: 'Trail by Annika Dasani',
  themes: 'Product · Operations · Gaming · Technology',
  name: "Annika Dasani's Career Trail",
  /** A small profile of the trail for the passport view. */
  profile: [
    { term: 'Trail', detail: 'How I Got Here' },
    { term: 'Stops', detail: '4' },
    { term: 'Theme', detail: 'Career journey' },
  ],
  /** What the site is for: on the opening panel, under the world where there is room, and in the passport. */
  demo: 'Built to demonstrate Roblox Trails, the product idea from my APM application.',
  passport: 'Passport',
  /** The short count on the passport button. */
  count: (done: number) => `${done}/4`,
  checkpoint: 'Checkpoint',
  checkpointComplete: 'Checkpoint complete',
  stampEarned: (stamp: string) => `${stamp} stamp earned`,
  skillsUnlocked: 'Skills unlocked',
  /** Status words for a stamp space. */
  stamped: 'Stamped',
  notStamped: 'Not stamped yet',
  complete: 'Trail complete',
  completeCount: '4 of 4 checkpoints completed',
  passportComplete: 'Passport complete. 4 stamps collected.',
  nextLabel: 'Next checkpoint',
  nextNote: 'Ready for the next adventure.',
  /**
   * The sticker on the Roblox space once the trail is complete. Annika asked for it on
   * 19 November 2026, as a wish. It is not a result: she is applying, the space under the
   * sticker is still not stamped, and the line beside it says that she is applying.
   */
  sticker: 'Hired!',
} as const

const discover: MissionContent & {
  steps: Readonly<Record<DiscoveryId, string>>
  pitchAction: string
  blocked: (missing: readonly string[]) => string
  nextAction: (label: string) => string
} = {
  id: 'discover',
  number: 1,
  title: 'Spot the Gap',
  shortTitle: 'Spot the Gap',
  place: 'The Pitch Deck',
  objective: 'Do the research, name the unmet need, and shape the concept. Then pitch it.',
  how: 'Click a step in the world, or use the buttons.',
  completeLine: 'Research, need, concept. The pitch is in.',
  steps: {
    research: 'Research',
    need: 'Unmet need',
    concept: 'Concept',
  },
  pitchAction: 'Pitch the concept',
  blocked: (missing) => `Not ready to pitch yet. Still to do: ${missing.join(', ')}.`,
  nextAction: (label) => `Work on ${label}`,
  checkpoint: {
    name: 'Discover',
    stamp: 'Discovery',
    source: '3 Day Startup',
    challenge: 'Accessibility and language barriers leave some players out of online play.',
    flow: ['Research', 'Identify need', 'Develop concept', 'Pitch'],
    metrics: [{ value: '2nd place', label: 'for the concept, pitched to investors' }],
    skills: ['User Research', 'Product Ideation'],
  },
  evidence: {
    quote:
      'At 3 Day Startup, I researched gaps in online gaming and developed an app concept to connect underserved players, including people facing accessibility or language barriers. I pitched the concept to investors and placed second.',
  },
}

const signal: MissionContent & {
  sources: Readonly<Record<SourceId, string>>
  feedAction: string
  blocked: (missing: readonly string[]) => string
  nextAction: (label: string) => string
} = {
  id: 'signal',
  number: 2,
  title: 'Find the Signal',
  shortTitle: 'The Signal',
  place: 'The Signal Station',
  objective: 'Switch on all three data sources, then start the automated feed.',
  how: 'Click a source in the world, or use the buttons.',
  completeLine: 'Three sources, one dashboard. The signal is clear.',
  sources: {
    revenue: 'Revenue',
    invoices: 'Invoice volume',
    inquiries: 'Customer inquiries',
  },
  feedAction: 'Start automated feed',
  blocked: (missing) => `The automated feed needs all three sources. Still off: ${missing.join(', ')}.`,
  nextAction: (label) => `Switch on ${label}`,
  checkpoint: {
    name: 'Build',
    stamp: 'Builder',
    source: 'Microsoft',
    challenge: 'Reporting across eight acquired companies took hours of manual work every week.',
    flow: ['Listen', 'Define', 'Build', 'Measure'],
    metrics: [
      { value: '~6 hours', label: 'of manual reporting saved every week' },
      { value: '8', label: 'acquired companies supported' },
    ],
    skills: ['Requirements Definition', 'Power BI', 'Success Metrics'],
  },
  evidence: {
    quote:
      'I interviewed users to understand reporting needs, then designed a self-service Power BI dashboard across eight acquired companies. It eliminated approximately six hours of weekly manual reporting.',
    note: 'The real dashboard combined revenue, invoice volume, and customer inquiries to proactively spot risks and trends.',
  },
}

const launch: MissionContent & {
  readiness: Readonly<Record<ReadinessId, string>>
  launchAction: string
  blocked: (missing: readonly string[]) => string
  nextAction: (label: string) => string
} = {
  id: 'launch',
  number: 3,
  title: 'Launch Day',
  shortTitle: 'Launch Day',
  place: 'The Launch Arch',
  objective: 'Get all three readiness checks to Ready, then launch.',
  how: 'Click a check in the world, or use the buttons.',
  completeLine: 'All checks ready. The arch is lit.',
  readiness: {
    requirements: 'Requirements',
    uat: 'User acceptance testing',
    comms: 'Communications',
  },
  launchAction: 'Launch',
  blocked: (missing) => `Not ready to launch yet. Still to prepare: ${missing.join(', ')}.`,
  nextAction: (label) => `Prepare ${label}`,
  checkpoint: {
    name: 'Ship',
    stamp: 'Launch',
    source: 'Microsoft',
    challenge: 'Two global tax-rate changes had to roll out across teams and systems.',
    teams: ['Engineering', 'Tax', 'Sales', 'Business'],
    metrics: [{ value: '2 global launches', label: 'of tax-rate changes, coordinated across teams' }],
    skills: ['User Acceptance Testing', 'Roadmap Planning', 'Cross-Functional Execution'],
  },
  evidence: {
    quote:
      'I translated business needs into engineering requirements and acceptance criteria, and coordinated roadmaps, dependencies, testing, and communications for two global tax-rate change rollouts.',
    note: 'Both rollouts were coordinated with engineering, tax, sales, and business partners.',
  },
}

const network: MissionContent & {
  companyLabels: readonly string[]
  progress: (connected: number) => string
} = {
  id: 'network',
  number: 4,
  title: 'Eight Worlds, One System',
  shortTitle: 'Eight Worlds',
  place: 'The Hub',
  objective: 'Connect all eight company blocks to the central hub.',
  how: 'Click a block in the world, or use the buttons.',
  completeLine: 'All eight connected. The hub is live.',
  companyLabels: [
    'Company A',
    'Company B',
    'Company C',
    'Company D',
    'Company E',
    'Company F',
    'Company G',
    'Company H',
  ],
  progress: (connected) => `${connected} of 8 connected`,
  checkpoint: {
    name: 'Scale',
    stamp: 'Scale',
    source: 'Microsoft',
    challenge: '$700M in acquisition billing sat across eight acquired companies.',
    metrics: [
      { value: '$700M', label: 'in acquisition billing centralized across 8 companies' },
      { value: '+$360M', label: 'in emergent revenue absorbed within 3 months' },
    ],
    theme: 'Building something once is different from building something that can scale.',
    skills: ['Scalable Processes', 'Operational Strategy'],
  },
  evidence: {
    quote:
      'At Microsoft, I built a framework to centralize $700M in acquisition billing across eight companies. It enabled an additional $360M in revenue to be absorbed within three months.',
  },
}

const finale = {
  heading: 'Next checkpoint: Roblox.',
  motivation:
    "I've built systems that help businesses work together. Now I want to help build experiences that bring people together.",
  applying: "Applying for Roblox's Associate Product Manager role.",
  /** The line beside the sticker, on the ending and in the passport once the trail is complete. Annika's wording. */
  applied: "Applied for Roblox's Associate Product Manager role.",
  resumeLabel: 'Read resume',
  linkedInLabel: 'LinkedIn',
  replayLabel: 'Replay',
} as const

const resume = {
  name: identity.name,
  headline: identity.role,
  summary:
    'Program manager with 3+ years at Microsoft building data tools, automation, and global launch processes. Experienced in user discovery, engineering requirements, pilot evaluation, and SQL-driven analysis. Developed and pitched an inclusive-gaming app concept.',
  skills: [
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
  ],
  sections: [
    {
      heading: 'Experience',
      entries: [
        {
          org: 'Microsoft',
          location: 'Redmond, WA',
          role: 'Business Operations Program Manager, Mergers & Acquisitions',
          dates: 'Mar 2022 to Jul 2025',
          bullets: [
            'Interviewed users to identify reporting needs and prioritize requirements; designed an automated, self-service Power BI dashboard combining revenue, invoice volume, and customer inquiries across 8 acquired companies, eliminating approximately 6 hours of weekly manual reporting.',
            'Translated business needs into engineering requirements and acceptance criteria; coordinated roadmaps, dependencies, system changes, user acceptance testing, and external communications for 2 global tax-rate change rollouts with engineering, tax, sales, and business partners.',
            'Defined success metrics and ran pilots to evaluate operational workflow changes, using findings to guide implementation before broader rollout.',
            'Built an execution framework to centralize $700M in acquisition billing across 8 companies, establishing scalable processes and training a team; enabled an additional $360M in emergent revenue to be absorbed within 3 months.',
            'Built a Power Automate workflow to classify incoming communications across 8 consolidated inboxes; refined keyword logic and exclusion rules through iterative testing.',
            'Analyzed 30+ acquisitions using SQL and Excel; developed tailored revenue-integration approaches, including engineered solutions and managed sunsets, to inform executive decisions.',
            'Owned go-to-market strategy and cross-functional execution for 3 acquisitions and 2 divestitures; advised acquired-company executives, surfaced delivery risks and dependencies, and coordinated transitions to maintain business continuity.',
          ],
        },
      ],
    },
    {
      heading: 'Product projects and leadership',
      entries: [
        {
          org: '3 Day Startup',
          location: 'College Station, TX',
          role: 'Participant and Mentor',
          dates: 'Apr 2019 to Dec 2020',
          bullets: [
            'Researched gaps in online gaming and developed an app concept to connect underserved players, including people facing accessibility or language barriers; pitched the concept to investors and placed second.',
            'Mentored 40 participants per semester from startup ideation through investor pitch as a Leadership Council member; led workshops and group discussions.',
          ],
        },
      ],
    },
    {
      heading: 'Additional experience',
      entries: [
        {
          org: 'Mercedes-Benz U.S. International',
          location: 'Vance, AL',
          role: 'Human Resources Intern',
          dates: 'Aug 2020 to Dec 2020',
          bullets: [
            'Redesigned the intern interview process to evaluate abilities across multiple teams; interviewed and hired interns for the 60-person 2021 Co-Op program.',
          ],
        },
      ],
    },
  ] as readonly ResumeSection[],
  education: {
    school: 'Texas A&M University, Mays Business School',
    location: 'College Station, TX',
    degree: 'Bachelor of Business Administration in Supply Chain Management',
    date: 'Dec 2021',
  },
  contactNote: 'Contact through LinkedIn.',
  /**
   * Public PDF download. Leave null until Annika approves a public PDF.
   * To enable: put the file in public/ and set, for example,
   * { href: '/Annika-Dasani-Resume.pdf', label: 'Download PDF' }.
   * The build fails if the file is missing, so a broken button can never ship.
   */
  publicPdf: null as PublicPdf | null,
}

const cardLabels = {
  realExperience: 'Real experience',
  continue: 'Continue',
  continueToFinale: 'See what comes next',
} as const

export const content = {
  identity,
  intro,
  overview,
  trail,
  missions: { discover, signal, launch, network },
  cardLabels,
  finale,
  resume,
}

export type Content = typeof content

/** The shared fields of a mission, for code that treats all four alike. */
export function missionContent(id: MissionId): MissionContent {
  return content.missions[id]
}
