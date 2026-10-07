import { useOutletContext } from 'react-router'
import type { Collection } from '@/lib/types'

/** The collection resolved by CollectionLayout for the current route. */
export function useCollection() {
  return useOutletContext<Collection>()
}
