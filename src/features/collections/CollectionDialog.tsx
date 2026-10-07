import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { slugify } from '@/lib/id'
import { validateBaseUrl } from '@/lib/path-match'
import type { Collection } from '@/lib/types'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

/** Create / edit collection settings. Mounted once in the app shell. */
export function CollectionDialog() {
  const dialog = useUi((s) => s.collectionDialog)
  const set = useUi((s) => s.set)
  const collection = useWorkspace((s) =>
    dialog?.mode === 'edit' ? s.collections.find((c) => c.id === dialog.id) : undefined,
  )
  const close = () => set({ collectionDialog: null })
  if (!dialog) return null
  // Keyed so the form state resets for every open.
  return (
    <CollectionForm
      key={dialog.mode === 'edit' ? dialog.id : 'create'}
      collection={collection}
      onClose={close}
    />
  )
}

function CollectionForm({ collection, onClose }: { collection?: Collection; onClose: () => void }) {
  const editing = !!collection
  const [name, setName] = useState(collection?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(collection?.baseUrl ?? '')
  const [baseTouched, setBaseTouched] = useState(editing)
  const [description, setDescription] = useState(collection?.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { createCollection, updateCollection, deleteCollection } = useWorkspace()
  const navigate = useNavigate()

  const effectiveBase = baseTouched ? baseUrl : `/api/${slugify(name || 'my-api')}`
  const baseError = validateBaseUrl(effectiveBase)
  const nameError = name.trim() ? null : 'Give your API a name'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (nameError || baseError) return
    if (collection) {
      updateCollection(collection.id, {
        name: name.trim(),
        baseUrl: effectiveBase.trim(),
        description,
      })
      toast.success('Collection updated')
    } else {
      const created = createCollection({
        name: name.trim(),
        baseUrl: effectiveBase.trim(),
        description,
      })
      navigate(`/app/c/${created.id}`)
      toast.success(`Created "${created.name}"`)
    }
    onClose()
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={editing ? 'Collection settings' : 'New collection'}
        description={
          editing
            ? 'Rename the API or move it to another base URL.'
            : 'A collection groups the endpoints of one API.'
        }
        footer={
          <>
            {editing ? (
              <Button
                variant="ghost"
                className="mr-auto text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                Delete collection
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="collection-form"
              disabled={!!nameError || !!baseError}
            >
              {editing ? 'Save changes' : 'Create collection'}
            </Button>
          </>
        }
      >
        <form id="collection-form" onSubmit={submit} className="space-y-4">
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Payments API"
                autoFocus
              />
            )}
          </Field>
          <Field
            label="Base URL"
            error={baseError}
            hint="Relative paths are served from this site, e.g. fetch('/api/payments/charges'). Absolute URLs (https://api.example.com) are intercepted too."
          >
            {(id) => (
              <Input
                id={id}
                value={effectiveBase}
                invalid={!!baseError}
                onChange={(e) => {
                  setBaseTouched(true)
                  setBaseUrl(e.target.value)
                }}
                className="font-mono text-[13px]"
                spellCheck={false}
              />
            )}
          </Field>
          <Field label="Description" hint="Optional">
            {(id) => (
              <Textarea
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What does this API do?"
              />
            )}
          </Field>
        </form>
      </Dialog>
      {collection ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete "${collection.name}"?`}
          description={`This removes ${collection.endpoints.length} endpoints and all stored resource data. This cannot be undone — export the collection first if you might need it.`}
          onConfirm={() => {
            deleteCollection(collection.id)
            onClose()
            navigate('/app/collections')
            toast.success('Collection deleted')
          }}
        />
      ) : null}
    </>
  )
}
