import { createResource } from '@/lib/crud'
import { createFaker } from '@/lib/faker'
import { generateRecords } from '@/lib/resource-store'

/** Renders one record from a template for the resource dialogs. */
export function previewRecord(
  template: string,
): { ok: true; value: string } | { ok: false; error: string } {
  try {
    const [record] = generateRecords(
      { ...createResource('preview'), seedCount: 1, recordTemplate: template },
      createFaker(3),
    )
    return { ok: true, value: JSON.stringify(record, null, 2) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
