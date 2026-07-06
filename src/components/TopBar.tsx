import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function TopBar({
  title,
  onBack,
  action,
}: {
  title: string
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <div className="app-topbar">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Retour" type="button">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1>{title}</h1>
      {action}
    </div>
  )
}
