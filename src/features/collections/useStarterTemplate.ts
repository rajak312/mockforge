import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { pluralize } from '@/lib/format'
import { STARTER_TEMPLATES } from '@/lib/starters'
import { useWorkspace } from '@/store/workspace'

/** Instantiates a starter template as a new collection and opens it. */
export function useStarterTemplate() {
  const addCollection = useWorkspace((s) => s.addCollection)
  const navigate = useNavigate()
  return (templateId: string) => {
    const template = STARTER_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const collection = addCollection(template.build())
    toast.success(`${template.name} is ready`, {
      description: `${pluralize(collection.endpoints.length, 'endpoint')} served at ${collection.baseUrl}`,
    })
    navigate(`/app/c/${collection.id}`)
  }
}
