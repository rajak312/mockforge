import {
  ArrowRight,
  Boxes,
  Braces,
  Database,
  FileCode,
  GitBranch,
  HardDrive,
  ScrollText,
  Send,
  Share2,
  Upload,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { buttonClass } from '@/components/ui/button-styles'
import { GithubIcon } from '@/components/ui/GithubIcon'
import { TemplateGallery } from '../collections/CollectionsPage'
import { REPO_URL, ThemeToggle } from '../shell/HeaderControls'
import { Logo } from '../shell/Logo'
import { LiveDemo } from './LiveDemo'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Braces,
    title: 'Dynamic templates',
    body: 'Faker, path params, query, headers and request body in any response — plus {{#repeat}} for realistic lists.',
  },
  {
    icon: GitBranch,
    title: 'Scenarios & rules',
    body: 'Multiple responses per endpoint. Pick one by hand or let rules on params, headers or body decide.',
  },
  {
    icon: Database,
    title: 'Stateful CRUD',
    body: 'Generate a REST resource in one click. POST, then GET — your writes persist in IndexedDB.',
  },
  {
    icon: Upload,
    title: 'OpenAPI import',
    body: 'Paste a 3.x spec in JSON or YAML. Schemas become templates with data that looks like production.',
  },
  {
    icon: FileCode,
    title: 'Export MSW handlers',
    body: 'Templates compile to real http.get() handlers for msw v2, ready to drop into your repo and tests.',
  },
  {
    icon: Send,
    title: 'Built-in API client',
    body: 'A focused Postman: params, headers, JSON body, history, cURL — with the matched mock shown on every response.',
  },
  {
    icon: ScrollText,
    title: 'Live request log',
    body: 'See every request the worker intercepts, which endpoint and response answered it, and how long it took.',
  },
  {
    icon: Share2,
    title: 'Share by URL',
    body: 'Whole collections compress into a link. No accounts, no servers — the data stays in the URL hash.',
  },
]

const STEPS = [
  {
    title: 'Design endpoints',
    body: 'Write responses in a JSON editor with autocompletion, inline validation and a live preview.',
    code: '"name": "{{faker.person.fullName}}"',
  },
  {
    title: 'Call them like a real API',
    body: 'A Mock Service Worker intercepts fetch() in this tab — from the client, devtools or the page itself.',
    code: "await fetch('/api/shop/products/1')",
  },
  {
    title: 'Ship the handlers',
    body: 'Export typed MSW handlers and keep the exact same mocks in your app, Storybook and Vitest.',
    code: "http.get('/api/shop/products/:id', …)",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav
            className="hidden items-center gap-5 text-sm text-muted md:flex"
            aria-label="Sections"
          >
            <a href="#features" className="hover:text-fg">
              Features
            </a>
            <a href="#how" className="hover:text-fg">
              How it works
            </a>
            <a href="#templates" className="hover:text-fg">
              Templates
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('ghost', 'icon')}
              aria-label="Source on GitHub"
            >
              <GithubIcon className="size-4" />
            </a>
            <ThemeToggle />
            <Link to="/app" className={buttonClass('primary', 'sm', 'ml-1')}>
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <a
                href="https://mswjs.io"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted shadow-sm hover:text-fg"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" /> Powered by Mock Service
                Worker · runs 100% in your browser
              </a>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                Mock any REST API <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-accent to-fuchsia-500 bg-clip-text text-transparent">
                  before it exists
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-pretty text-muted sm:text-lg">
                MockForge lets you design endpoints, generate realistic data with templates,
                simulate errors and latency, and test it all with a built-in client. Then export
                production-ready MSW handlers. No backend, no sign-up.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/app" className={buttonClass('primary', 'lg')}>
                  Open the workspace <ArrowRight />
                </Link>
                <a href="#templates" className={buttonClass('outline', 'lg')}>
                  Start from a template
                </a>
              </div>
            </div>
            <div className="mx-auto mt-14 max-w-5xl">
              <LiveDemo />
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-line bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-accent">Everything a frontend team needs</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Build the UI today. Plug in the real API tomorrow.
              </h2>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-surface p-6">
                  <Icon className="size-5 text-accent" aria-hidden />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-line py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-accent">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                A real network layer, without a server
              </h2>
              <p className="mt-3 text-muted">
                Your mocks live in IndexedDB. A service worker registered by MSW catches matching
                requests and asks the page for a response, so the browser sees genuine HTTP — status
                codes, headers, latency and all.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col rounded-2xl border border-line bg-surface p-6"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm text-muted">{step.body}</p>
                  <code className="mt-4 block truncate rounded-lg border border-line bg-code px-3 py-2 text-[12px] text-fg">
                    {step.code}
                  </code>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-5 text-sm text-muted">
              <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
                <Boxes className="size-4 text-accent" /> Your UI
              </span>
              <ArrowRight className="size-4" aria-hidden />
              <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-mono text-xs shadow-sm">
                fetch()
              </span>
              <ArrowRight className="size-4" aria-hidden />
              <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
                <Workflow className="size-4 text-accent" /> Service worker
              </span>
              <ArrowRight className="size-4" aria-hidden />
              <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
                <HardDrive className="size-4 text-accent" /> Your mocks
              </span>
            </div>
          </div>
        </section>

        <section id="templates" className="border-t border-line bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="mr-auto max-w-2xl">
                <p className="text-sm font-medium text-accent">Starter templates</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Start with a working API in one click
                </h2>
              </div>
              <Link to="/app/collections" className={buttonClass('outline')}>
                Browse workspace <ArrowRight />
              </Link>
            </div>
            <div className="mt-8">
              <TemplateGallery />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-sm text-muted sm:px-6">
          <Logo />
          <p>
            Built by{' '}
            <a
              href="https://github.com/lalitkumarrajak"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-fg hover:text-accent"
            >
              Lalit Kumar Rajak
            </a>{' '}
            · MIT licensed
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 hover:text-fg"
          >
            <GithubIcon className="size-4" /> Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
