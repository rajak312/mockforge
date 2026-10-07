import { useMemo } from 'react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { CopyButton } from '@/components/ui/CopyButton'
import { generateHandler } from '@/lib/codegen/msw'
import { toCurl } from '@/lib/codegen/curl'
import { faker } from '@/lib/faker'
import { sampleRequestBody, sampleUrl } from '@/lib/sample'
import type { Collection, Endpoint } from '@/lib/types'

function absolute(url: string) {
  return /^https?:\/\//.test(url) ? url : `${location.origin}${url}`
}

export function CodeTab({ collection, endpoint }: { collection: Collection; endpoint: Endpoint }) {
  const handler = useMemo(() => {
    try {
      const { code, uses } = generateHandler(collection, endpoint)
      const imports = [
        `import { ${/\bdelay\(/.test(code) ? 'delay, ' : ''}http, HttpResponse } from 'msw'`,
      ]
      if (uses.faker) imports.push(`import { faker } from '@faker-js/faker'`)
      return `${imports.join('\n')}\n\nexport const handler = ${code}\n`
    } catch (error) {
      return `// Could not generate code: ${(error as Error).message}\n// Fix the template errors in the Responses tab.`
    }
  }, [collection, endpoint])

  const curl = useMemo(() => {
    const body = sampleRequestBody(collection, endpoint, faker)
    return toCurl({
      method: endpoint.method,
      url: absolute(sampleUrl(collection, endpoint)),
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body,
    })
  }, [collection, endpoint])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section
          className="overflow-hidden rounded-xl border border-line"
          aria-labelledby="msw-heading"
        >
          <header className="flex items-center gap-2 border-b border-line bg-surface-2/50 px-4 py-2">
            <h3 id="msw-heading" className="text-sm font-semibold">
              MSW handler
            </h3>
            <span className="hidden text-xs text-subtle sm:inline">
              templates compiled to real expressions · msw v2
            </span>
            <CopyButton text={handler} className="ml-auto" toastLabel="Handler copied" />
          </header>
          <CodeEditor
            value={handler}
            readOnly
            language="javascript"
            ariaLabel="Generated MSW handler"
            className="max-h-[480px] overflow-auto"
          />
        </section>
        <section
          className="overflow-hidden rounded-xl border border-line"
          aria-labelledby="curl-heading"
        >
          <header className="flex items-center gap-2 border-b border-line bg-surface-2/50 px-4 py-2">
            <h3 id="curl-heading" className="text-sm font-semibold">
              cURL
            </h3>
            <span className="hidden text-xs text-subtle sm:inline">
              mocks answer requests from this tab only — use it against your real API
            </span>
            <CopyButton text={curl} className="ml-auto" toastLabel="cURL copied" />
          </header>
          <CodeEditor
            value={curl}
            readOnly
            language="text"
            lineNumbers={false}
            ariaLabel="cURL command"
          />
        </section>
      </div>
    </div>
  )
}
