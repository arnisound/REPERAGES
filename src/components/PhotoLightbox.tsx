import { X } from 'lucide-react'
import { usePhotoUrl } from '../hooks/usePhotoUrl'

export default function PhotoLightbox({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const url = usePhotoUrl(photoId)
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        className="icon-btn"
        onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)' }}
        aria-label="Fermer"
        type="button"
      >
        <X size={22} />
      </button>
      {url && <img src={url} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain' }} />}
    </div>
  )
}
