import { FolderX } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { buttonClass } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { selectCollection, useWorkspace } from '@/store/workspace'
import { ResourceDialog } from '../resources/ResourceDialog'

export default function CollectionLayout() {
  const { collectionId } = useParams()
  const collection = useWorkspace(selectCollection(collectionId))
  const setActive = useWorkspace((s) => s.setActiveCollection)

  useEffect(() => {
    if (collection) setActive(collection.id)
  }, [collection?.id, collection, setActive])

  useEffect(() => {
    if (collection) document.title = `${collection.name} · MockForge`
    return () => {
      document.title = 'MockForge — Mock REST APIs in your browser'
    }
  }, [collection?.name, collection])

  if (!collection) {
    return (
      <EmptyState
        className="h-full"
        icon={FolderX}
        title="Collection not found"
        description="It may have been deleted, or it lives in another browser. Collections are stored locally in IndexedDB."
        action={
          <Link to="/app/collections" className={buttonClass('primary')}>
            View collections
          </Link>
        }
      />
    )
  }

  return (
    <>
      <Suspense
        fallback={
          <div className="grid h-full place-items-center" role="status" aria-label="Loading">
            <div className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        }
      >
        <Outlet context={collection} />
      </Suspense>
      <ResourceDialog collection={collection} />
    </>
  )
}
