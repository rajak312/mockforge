export interface CurlInput {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

/** POSIX shell single-quote escaping. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function toCurl({ method, url, headers = {}, body }: CurlInput): string {
  const parts = ['curl']
  const upper = method.toUpperCase()
  if (upper !== 'GET' || body) parts.push(`-X ${upper}`)
  parts.push(shellQuote(url))
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim()) parts.push(`-H ${shellQuote(`${key}: ${value}`)}`)
  }
  if (body) parts.push(`--data-raw ${shellQuote(body)}`)
  return parts.join(' \\\n  ')
}
