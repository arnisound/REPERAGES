import { useRef } from 'react'
import { Printer } from 'lucide-react'
import type { CropRect } from './SitePlanCanvas'

/**
 * Cadre de zone d'impression superposé au canvas : déplaçable au doigt,
 * redimensionnable par la poignée coin, avec un masque assombri autour.
 * Conserve le ratio A4 paysage au redimensionnement.
 */
export default function PrintFrameOverlay({
  frame,
  onChange,
  onExport,
}: {
  frame: CropRect
  onChange: (f: CropRect) => void
  onExport: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: CropRect } | null>(null)

  function pointer(e: React.PointerEvent) {
    return { x: e.clientX, y: e.clientY }
  }

  function onDown(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const p = pointer(e)
    drag.current = { mode, sx: p.x, sy: p.y, start: { ...frame } }
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current) return
    const p = pointer(e)
    const dx = p.x - drag.current.sx
    const dy = p.y - drag.current.sy
    const box = containerRef.current?.getBoundingClientRect()
    const start = drag.current.start
    if (drag.current.mode === 'move') {
      let x = start.x + dx
      let y = start.y + dy
      if (box) {
        x = Math.max(0, Math.min(x, box.width - start.w))
        y = Math.max(0, Math.min(y, box.height - start.h))
      }
      onChange({ ...frame, x, y })
    } else {
      // Redimensionnement en conservant le ratio A4 (297:210)
      const ratio = 297 / 210
      let w = Math.max(60, start.w + dx)
      if (box) w = Math.min(w, box.width - start.x)
      let h = w / ratio
      if (box && start.y + h > box.height) {
        h = box.height - start.y
        w = h * ratio
      }
      onChange({ ...frame, w, h })
    }
  }

  function onUp(e: React.PointerEvent) {
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    drag.current = null
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 550 }}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {/* Masque sombre autour du cadre (4 bandes) */}
      {(
        [
          { left: 0, top: 0, width: '100%', height: frame.y },
          { left: 0, top: frame.y + frame.h, width: '100%', bottom: 0 },
          { left: 0, top: frame.y, width: frame.x, height: frame.h },
          { left: frame.x + frame.w, top: frame.y, right: 0, height: frame.h },
        ] as React.CSSProperties[]
      ).map((s, i) => (
        <div key={i} style={{ position: 'absolute', background: 'rgba(11,18,32,0.55)', ...s }} />
      ))}

      {/* Le cadre */}
      <div
        onPointerDown={(e) => onDown('move', e)}
        style={{
          position: 'absolute',
          left: frame.x,
          top: frame.y,
          width: frame.w,
          height: frame.h,
          border: '2px solid var(--accent)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
          touchAction: 'none',
          cursor: 'move',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            fontSize: 11,
            background: 'var(--accent)',
            color: '#04202f',
            padding: '2px 6px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Zone d'impression
        </div>
        <button
          className="btn"
          style={{ position: 'absolute', top: 6, right: 6, minHeight: 32, padding: '4px 10px', fontSize: 12 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onExport}
          type="button"
        >
          <Printer size={14} /> Exporter
        </button>
        {/* Poignée de redimensionnement (coin bas-droit) */}
        <div
          onPointerDown={(e) => onDown('resize', e)}
          style={{
            position: 'absolute',
            right: -12,
            bottom: -12,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '2px solid #04202f',
            touchAction: 'none',
            cursor: 'nwse-resize',
          }}
        />
      </div>
    </div>
  )
}
