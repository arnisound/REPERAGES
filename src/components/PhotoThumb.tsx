import { X } from 'lucide-react'
import { usePhotoUrl } from '../hooks/usePhotoUrl'

export default function PhotoThumb({
  photoId,
  onRemove,
  onClick,
}: {
  photoId: string
  onRemove?: () => void
  onClick?: () => void
}) {
  const url = usePhotoUrl(photoId)
  return (
    <div className="photo-thumb" onClick={onClick}>
      {url && <img src={url} alt="" />}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Supprimer la photo"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
