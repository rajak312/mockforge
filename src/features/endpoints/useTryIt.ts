import { useNavigate } from 'react-router'
import { createKeyValue, JSON_HEADER } from '@/lib/factory'
import { faker } from '@/lib/faker'
import { sampleRequestBody, sampleUrl } from '@/lib/sample'
import type { Collection, Endpoint } from '@/lib/types'
import { useClient } from '@/store/client'

/** Prefills the API client with a request that matches the endpoint and opens it. */
export function useTryIt() {
  const navigate = useNavigate()
  const replaceDraft = useClient((s) => s.replaceDraft)
  return (collection: Collection, endpoint: Endpoint) => {
    const body = sampleRequestBody(collection, endpoint, faker)
    replaceDraft(collection.id, {
      method: endpoint.method,
      url: sampleUrl(collection, endpoint),
      headers: [{ ...JSON_HEADER(), enabled: !!body }, createKeyValue()],
      body,
    })
    navigate(`/app/c/${collection.id}/client`)
  }
}
