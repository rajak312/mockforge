import { base, en, Faker, faker } from '@faker-js/faker'

/** Creates an isolated faker instance (optionally seeded for deterministic previews). */
export function createFaker(seed?: number): Faker {
  const instance = new Faker({ locale: [en, base] })
  if (seed !== undefined) instance.seed(seed)
  return instance
}

export { faker }
