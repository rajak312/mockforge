import {
  Braces,
  ChevronDown,
  Download,
  ExternalLink,
  FileCode,
  Link2,
  Share2,
  Terminal,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { generateHandlersFile } from '@/lib/codegen/msw'
import { toCurl } from '@/lib/codegen/curl'
import { faker } from '@/lib/faker'
import { downloadFile, pluralize } from '@/lib/format'
import { formatBytes } from '@/lib/http'
import { slugify } from '@/lib/id'
import { sampleRequestBody, sampleUrl } from '@/lib/sample'
import { buildShareUrl, exportCollection } from '@/lib/serialize'
import { useCollection } from '../shell/useCollection'

function Card({
  icon: Icon,
  title,
  description,
  actions,
  children,
}: {
  icon: typeof Share2
  title: string
  description: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start gap-3 px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

const USAGE = `// src/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

// main.tsx — start before rendering
if (import.meta.env.DEV) {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}`

export default function ExportPage() {
  const collection = useCollection()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showUsage, setShowUsage] = useState(false)
  const json = useMemo(() => exportCollection(collection), [collection])
  const handlers = useMemo(() => {
    try {
      return generateHandlersFile(collection)
    } catch (error) {
      return `// Could not generate handlers: ${(error as Error).message}`
    }
  }, [collection])
  const slug = slugify(collection.name)
  const curls = useMemo(
    () =>
      collection.endpoints.map((endpoint) => {
        const url = sampleUrl(collection, endpoint)
        const body = sampleRequestBody(collection, endpoint, faker)
        return {
          endpoint,
          command: toCurl({
            method: endpoint.method,
            url: /^https?:/.test(url) ? url : location.origin + url,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body,
          }),
        }
      }),
    [collection],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Export & share</h1>
          <p className="mt-1 text-sm text-muted">
            Take {collection.name} anywhere: a link for teammates, a JSON backup, or MSW handlers
            for your codebase.
          </p>
        </div>

        <Card
          icon={Share2}
          title="Share link"
          description="The whole collection is compressed into the URL hash with lz-string — nothing is uploaded anywhere."
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShareUrl(buildShareUrl(collection, location.origin))}
            >
              <Link2 /> {shareUrl ? 'Regenerate' : 'Create link'}
            </Button>
          }
        >
          {shareUrl ? (
            <div className="space-y-2 border-t border-line px-5 py-4">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  aria-label="Share link"
                  onFocus={(e) => e.target.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/50 px-3 font-mono text-xs"
                />
                <CopyButton text={shareUrl} variant="outline" toastLabel="Share link copied" />
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg"
                  aria-label="Open share link in a new tab"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
              <p className="text-xs text-subtle">
                {shareUrl.length.toLocaleString()} characters ({formatBytes(json.length)} of JSON
                before compression)
              </p>
              {shareUrl.length > 8000 ? (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3.5" /> Long links can be truncated by chat apps —
                  share the JSON file for big collections.
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card
          icon={Braces}
          title="Collection JSON"
          description={`Versioned backup of ${pluralize(collection.endpoints.length, 'endpoint')} and ${pluralize(collection.resources.length, 'resource')}. Import it on any machine.`}
          actions={
            <>
              <CopyButton text={json} variant="outline" toastLabel="JSON copied" />
              <Button
                size="sm"
                variant="primary"
                onClick={() => downloadFile(`${slug}.mockforge.json`, json)}
              >
                <Download /> Download
              </Button>
            </>
          }
        />

        <Card
          icon={FileCode}
          title="MSW handlers"
          description="A typed handlers.ts for msw v2. Templates become real faker / request expressions and CRUD resources become an in-memory db."
          actions={
            <>
              <CopyButton text={handlers} variant="outline" toastLabel="Handlers copied" />
              <Button
                size="sm"
                variant="primary"
                onClick={() => downloadFile('handlers.ts', handlers, 'text/typescript')}
              >
                <Download /> handlers.ts
              </Button>
            </>
          }
        >
          <div className="border-t border-line">
            <CodeEditor
              value={handlers}
              readOnly
              language="javascript"
              ariaLabel="Generated MSW handlers"
              className="max-h-[520px] overflow-auto"
            />
          </div>
          <div className="border-t border-line px-5 py-2.5">
            <button
              type="button"
              aria-expanded={showUsage}
              onClick={() => setShowUsage((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${showUsage ? '' : '-rotate-90'}`}
              />{' '}
              How to use it in your app
            </button>
          </div>
          {showUsage ? (
            <div className="border-t border-line">
              <CodeEditor
                value={USAGE}
                readOnly
                language="javascript"
                ariaLabel="MSW usage example"
                lineNumbers={false}
              />
            </div>
          ) : null}
        </Card>

        <Card
          icon={Terminal}
          title="cURL"
          description="One command per endpoint with sample params and bodies — handy for replaying against the real API once it exists."
        >
          <ul className="divide-y divide-line border-t border-line">
            {curls.map(({ endpoint, command }) => (
              <li key={endpoint.id} className="flex items-start gap-3 px-5 py-2.5">
                <MethodBadge method={endpoint.method} compact className="mt-0.5" />
                <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[11.5px] leading-relaxed whitespace-pre text-muted">
                  {command}
                </pre>
                <CopyButton
                  text={command}
                  label={`Copy cURL for ${endpoint.method} ${endpoint.path}`}
                  showLabel={false}
                  toastLabel="cURL copied"
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
