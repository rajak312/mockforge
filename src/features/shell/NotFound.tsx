import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { buttonClass } from '@/components/ui/button-styles'
import { Logo } from './Logo'

export default function NotFound() {
  return (
    <main className="grid-bg flex min-h-full flex-col items-center justify-center gap-8 bg-bg p-6">
      <Logo />
      <div className="panel max-w-md p-8 text-center shadow-panel">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Compass className="size-5" />
        </div>
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-1 text-lg font-semibold">This page isn&apos;t mocked</h1>
        <p className="mt-2 text-sm text-muted">
          The page you are looking for doesn&apos;t exist. Your mock APIs live in the workspace.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={buttonClass('secondary')}>
            Home
          </Link>
          <Link to="/app" className={buttonClass('primary')}>
            Open workspace
          </Link>
        </div>
      </div>
    </main>
  )
}
