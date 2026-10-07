import { FileUp, Link2, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MethodBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { pluralize } from '@/lib/format'
import { importOpenApi } from '@/lib/openapi'
import { decodeShare, extractSharePayload, importCollectionJson } from '@/lib/serialize'
import { SAMPLE_OPENAPI } from '@/lib/starters/sample-openapi'
import type { Collection } from '@/lib/types'
import { useUi, type ImportTab } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

type Preview =
  { ok: true; collection: Collection; warnings: string[] } | { ok: false; error: string } | null

function usePreview(tab: ImportTab, text: string): Preview {
  return useMemo(() => {
    if (!text.trim()) return null
    try {
      if (tab === 'openapi') return { ok: true, ...importOpenApi(text) }
      if (tab === 'json') return { ok: true, collection: importCollectionJson(text), warnings: [] }
      return { ok: true, collection: decodeShare(extractSharePayload(text)), warnings: [] }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }, [tab, text])
}

export function ImportDialog() {
  const tab = useUi((s) => s.importTab)
  const set = useUi((s) => s.set)
  if (!tab) return null
  return <ImportForm initialTab={tab} onClose={() => set({ importTab: null })} />
}

function ImportForm({ initialTab, onClose }: { initialTab: ImportTab; onClose: () => void }) {
  const [tab, setTab] = useState<ImportTab>(initialTab)
  const [texts, setTexts] = useState<Record<ImportTab, string>>({ openapi: '', json: '', link: '' })
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const text = texts[tab]
  const preview = usePreview(tab, text)
  const addCollection = useWorkspace((s) => s.addCollection)
  const navigate = useNavigate()

  const setText = (value: string) => setTexts((t) => ({ ...t, [tab]: value }))

  const readFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is larger than 5 MB')
      return
    }
    setText(await file.text())
  }

  const confirm = () => {
    if (!preview?.ok) return
    addCollection(preview.collection)
    toast.success(`Imported "${preview.collection.name}"`, {
      description: pluralize(preview.collection.endpoints.length, 'endpoint'),
    })
    onClose()
    navigate(`/app/c/${preview.collection.id}`)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Import an API"
      description="Bring in an OpenAPI 3 spec, a MockForge export, or a share link."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!preview?.ok}>
            {preview?.ok
              ? `Import ${pluralize(preview.collection.endpoints.length, 'endpoint')}`
              : 'Import'}
          </Button>
        </>
      }
    >
      <Tabs
        label="Import source"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'openapi', label: 'OpenAPI 3' },
          { id: 'json', label: 'Collection JSON' },
          { id: 'link', label: 'Share link' },
        ]}
        className="mb-4"
      />

      {tab === 'link' ? (
        <div className="space-y-2">
          <label htmlFor="share-link" className="label flex items-center gap-1.5">
            <Link2 className="size-3.5" /> Paste a MockForge share link
          </label>
          <Input
            id="share-link"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://…/share#N4Ig…"
            className="font-mono text-xs"
            autoFocus
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) void readFile(file)
          }}
          className={`overflow-hidden rounded-xl border ${dragging ? 'border-accent ring-2 ring-accent/20' : 'border-line'}`}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
            <p className="mr-auto text-xs text-muted">
              {tab === 'openapi'
                ? 'Paste JSON or YAML, or drop a file here'
                : 'Paste an exported collection, or drop the .json file'}
            </p>
            {tab === 'openapi' ? (
              <Button size="xs" variant="ghost" onClick={() => setText(SAMPLE_OPENAPI)}>
                Load sample spec
              </Button>
            ) : null}
            <Button size="xs" variant="outline" onClick={() => fileInput.current?.click()}>
              <FileUp /> Choose file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={tab === 'openapi' ? '.json,.yaml,.yml' : '.json'}
              className="hidden"
              aria-label="Choose file to import"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void readFile(file)
                e.target.value = ''
              }}
            />
          </div>
          <CodeEditor
            key={tab}
            value={text}
            onChange={setText}
            language={tab === 'json' ? 'json' : 'text'}
            ariaLabel={tab === 'openapi' ? 'OpenAPI document' : 'Collection JSON'}
            placeholder={
              tab === 'openapi'
                ? 'openapi: 3.0.3\ninfo:\n  title: My API\npaths: …'
                : '{ "format": "mockforge.collection", … }'
            }
            className="h-56"
          />
        </div>
      )}

      <div className="mt-4" aria-live="polite">
        {preview?.ok === false ? (
          <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {preview.error}
          </p>
        ) : preview?.ok ? (
          <ImportPreview collection={preview.collection} warnings={preview.warnings} />
        ) : null}
      </div>
    </Dialog>
  )
}

function ImportPreview({ collection, warnings }: { collection: Collection; warnings: string[] }) {
  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">{collection.name}</h3>
        <code className="text-xs text-muted">{collection.baseUrl}</code>
        <span className="ml-auto text-xs text-subtle">
          {pluralize(collection.endpoints.length, 'endpoint')}
          {collection.resources.length
            ? ` · ${pluralize(collection.resources.length, 'resource')}`
            : ''}
        </span>
      </div>
      <ul className="max-h-40 divide-y divide-line overflow-y-auto">
        {collection.endpoints.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]">
            <MethodBadge method={e.method} compact />
            <code className="truncate">{e.path}</code>
            <span className="ml-auto truncate text-xs text-subtle">
              {pluralize(e.variants.length, 'response')}
            </span>
          </li>
        ))}
      </ul>
      {warnings.length ? (
        <ul className="space-y-1 border-t border-line bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
