import { toast } from 'sonner'

export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
    return true
  } catch {
    toast.error('Clipboard access was denied by the browser')
    return false
  }
}
