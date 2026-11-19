import type { MissionId, ReadinessId, SourceId } from '../state/types.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Factual content for Next Checkpoint. This is the only file that holds career
// claims, so editing the words on the site means editing this file.
//
// Keep these distinctions when editing:
//  - $700M is acquisition-billing scope and $360M is additional revenue the
//    framework accommodated. Neither is revenue generated or personally processed.
//  - The gaming project was an app concept and a pitch. It was not built, tested,
//    or shipped.
//  - The missions are illustrations. The "Real experience" cards are the facts.
//  - Public contact is LinkedIn only. Do not add a phone number or personal email.
// ─────────────────────────────────────────────────────────────────────────────

export interface Evidence {
  /** Shown under the "Real experience" label, in Annika's words. */
  quote: string
  /** Two short supporting labels. */
  labels: readonly [string, string]
  /** One line that keeps the claim precise. */
  note: string
}

export interface MissionContent {
  id: MissionId
  number: 1 | 2 | 3
  title: string
  /** Compact title for narrow screens. */
  shortTitle: string
  /** Name of the destination in the world. */
  place: string
  objective: string
  /** How to act, for both the 3D world and the HTML buttons. */
  how: string
  /** Makes clear that the mini-game is an illustration. */
  illustrationNote: string
  /** Status line once the mission is complete. */
  completeLine: string
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
    'A small playable resume. Visit three destinations, finish a short mission at each, and see the real work behind it.',
  startLabel: 'Start playing',
  tourLabel: 'Guided tour',
  tourNote: 'Hands-free, about 55 seconds.',
  resumeLabel: 'Read resume',
} as const

const overview = {
  heading: 'Choose a destination',
  body: 'Click a building in the world or pick a mission here. Any order works.',
  progress: (done: number) => `${done} of 3 checkpoints reached`,
} as const

const network: MissionContent & {
  companyLabels: readonly string[]
  progress: (connected: number) => string
} = {
  id: 'network',
  number: 1,
  title: 'Eight Worlds, One System',
  shortTitle: 'Eight Worlds',
  place: 'The Hub',
  objective: 'Connect all eight company blocks to the central hub.',
  how: 'Click a block in the world, or use the buttons.',
  illustrationNote: 'Illustration only. The blocks are generic stand-ins, not the actual companies.',
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
  evidence: {
    quote:
      'At Microsoft, I built a framework to centralize $700M in acquisition billing across eight companies. It enabled an additional $360M in revenue to be absorbed within three months.',
    labels: ['Scalable processes', 'Cross-functional execution'],
    note: '$700M is the acquisition billing the framework centralized, and $360M is additional revenue it accommodated. Neither figure is revenue I generated.',
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
  illustrationNote: 'Illustration only. The bars are not real data or records.',
  completeLine: 'Three sources, one dashboard. The signal is clear.',
  sources: {
    revenue: 'Revenue',
    invoices: 'Invoice volume',
    inquiries: 'Customer inquiries',
  },
  feedAction: 'Start automated feed',
  blocked: (missing) => `The automated feed needs all three sources. Still off: ${missing.join(', ')}.`,
  nextAction: (label) => `Switch on ${label}`,
  evidence: {
    quote:
      'I interviewed users to understand reporting needs, then designed a self-service Power BI dashboard across eight acquired companies. It eliminated approximately six hours of weekly manual reporting.',
    labels: ['User discovery', 'Analytics'],
    note: 'The real dashboard combined revenue, invoice volume, and customer inquiries. The bars in this world are illustrative.',
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
  illustrationNote:
    'These steps represent coordinated delivery. They are not the exact historical project sequence.',
  completeLine: 'All checks ready. The arch is lit.',
  readiness: {
    requirements: 'Requirements',
    uat: 'User acceptance testing',
    comms: 'Communications',
  },
  launchAction: 'Launch',
  blocked: (missing) => `Not ready to launch yet. Still to prepare: ${missing.join(', ')}.`,
  nextAction: (label) => `Prepare ${label}`,
  evidence: {
    quote:
      'I translated business needs into engineering requirements and acceptance criteria, and coordinated roadmaps, dependencies, testing, and communications for two global tax-rate change rollouts.',
    labels: ['Acceptance criteria', 'Launch execution'],
    note: 'Both rollouts were coordinated with engineering, tax, sales, and business partners.',
  },
}

const finale = {
  heading: 'Next checkpoint: Roblox.',
  motivation:
    "I've built systems that help businesses work together. Now I want to help build experiences that bring people together.",
  gaming:
    'It connects to an idea I pitched at 3 Day Startup: an app concept for connecting underserved players, including people facing accessibility or language barriers. The pitch placed second.',
  applying: "Applying for Roblox's Associate Product Manager role.",
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

const credit = {
  line: 'Independent project. Not affiliated with or endorsed by Roblox.',
} as const

const cardLabels = {
  realExperience: 'Real experience',
  continue: 'Continue',
  continueToFinale: 'See what comes next',
} as const

export const content = {
  identity,
  intro,
  overview,
  missions: { network, signal, launch },
  cardLabels,
  finale,
  resume,
  credit,
}

export type Content = typeof content

/** The shared fields of a mission, for code that treats all three alike. */
export function missionContent(id: MissionId): MissionContent {
  return content.missions[id]
}
