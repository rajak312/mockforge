import { Boxes, MousePointerClick, Plus, Sparkles, Upload } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { Kbd } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { modKey } from '@/hooks/useHotkey'
import { cn } from '@/lib/cn'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { useCollection } from '../shell/useCollection'
import { EndpointEditor } from './EndpointEditor'
import { EndpointSidebar } from './EndpointSidebar'

export default function EndpointsPage() {
  const collection = useCollection()
  const { endpointId } = useParams()
  const endpoint = collection.endpoints.find((e) => e.id === endpointId)
  const set = useUi((s) => s.set)
  const addEndpoint = useWorkspace((s) => s.addEndpoint)
  const navigate = useNavigate()
  const selected = !!endpoint

  const createEndpoint = () => {
    const created = addEndpoint(collection.id)
    navigate(`/app/c/${collection.id}/e/${created.id}`)
  }

  return (
    <div className="flex h-full min-h-0">
      <EndpointSidebar
        collection={collection}
        className={cn('w-full shrink-0 lg:w-80', selected && 'max-lg:hidden')}
      />
      <div className={cn('min-w-0 flex-1', !selected && 'max-lg:hidden')}>
        {endpoint ? (
          <EndpointEditor key={endpoint.id} collection={collection} endpoint={endpoint} />
        ) : collection.endpoints.length === 0 ? (
          <EmptyState
            className="h-full"
            icon={Boxes}
            title="This API has no endpoints yet"
            description={
              <>
                Add an endpoint by hand, generate a stateful REST resource in one click, or import
                an OpenAPI spec. Requests to <code className="text-fg">{collection.baseUrl}</code>{' '}
                are answered by your mocks.
              </>
            }
            action={
              <>
                <Button variant="primary" onClick={createEndpoint}>
                  <Plus /> New endpoint
                </Button>
                <Button variant="outline" onClick={() => set({ resourceDialogOpen: true })}>
                  <Sparkles /> Generate REST resource
                </Button>
                <Button variant="outline" onClick={() => set({ importTab: 'openapi' })}>
                  <Upload /> Import OpenAPI
                </Button>
              </>
            }
          />
        ) : (
          <EmptyState
            className="h-full"
            icon={MousePointerClick}
            title="Select an endpoint"
            description={
              <>
                Pick an endpoint from the list to edit its responses, or press <Kbd>{modKey}</Kbd>{' '}
                <Kbd>K</Kbd> to jump anywhere.
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
