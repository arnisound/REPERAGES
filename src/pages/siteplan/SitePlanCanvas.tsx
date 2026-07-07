import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { Discipline, GeoPoint, LatLng, SiteLine, SiteObject } from '../../types'
import { DISCIPLINE_COLORS, POINT_CATEGORY_COLORS } from '../../types'
import { findLineDef, objectView } from '../../utils/catalog'
import { formatMeters, fromLocalMeters, lineLengthMeters, polygonCenter, toLocalMeters } from '../../utils/geo'

export type SitePlanMode = 'view' | 'place' | 'line' | 'multi' | 'check'

export type SitePlanBase = 'none' | 'osm' | 'sat'

export type SiteSelection = { kind: 'object'; id: string } | { kind: 'line'; id: string } | null

/** Poignée d'export : capture la vue courante du plan en PNG haute résolution. */
export interface SitePlanCanvasHandle {
  exportImage: (targetWidthPx?: number) => string | null
}

/** Plan importé géoréférencé, affiché sous les objets. */
export interface OverlayItem {
  id: string
  url: string
  center: LatLng
  rotation: number
  widthM: number
  heightM: number
  opacity: number
  editing: boolean
}

interface Props {
  zone: LatLng[]
  objects: SiteObject[]
  lines: SiteLine[]
  points: GeoPoint[]
  visibleLayers: Set<Discipline>
  showPoints: boolean
  mode: SitePlanMode
  baseLayer: SitePlanBase
  selection: SiteSelection
  /** Ids (objets et lignes) retenus en mode sélection multiple. */
  multiIds: Set<string>
  lineDraft: LatLng[]
  overlays: OverlayItem[]
  onTap: (gps: LatLng) => void
  onSelect: (sel: SiteSelection) => void
  onToggleMulti: (id: string) => void
  onOverlayMove: (id: string, gps: LatLng) => void
  onObjectMove: (id: string, gps: LatLng) => void
  /** Déplacement de groupe en mètres (est / nord) après glisser en mode multi. */
  onGroupMove: (eastM: number, northM: number) => void
  onDraftPointMove: (index: number, gps: LatLng) => void
  onViewScaleChange?: (pxPerMeter: number) => void
  exportRef?: React.MutableRefObject<SitePlanCanvasHandle | null>
}

/** Pick a grid step so cells stay readable at the current zoom. */
export function gridStep(viewScale: number): number {
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200]
  for (const s of steps) if (s * viewScale >= 42) return s
  return 500
}

const STATUS_COLORS = { done: '#34d399', checked: '#38bdf8' } as const

// Web Mercator tile math (slippy map tiles)
function lngToTileX(lng: number, z: number) {
  return ((lng + 180) / 360) * 2 ** z
}
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}
function tileNW(x: number, y: number, z: number): LatLng {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / 2 ** z) * 360 - 180 }
}

export default function SitePlanCanvas({
  zone,
  objects,
  lines,
  points,
  visibleLayers,
  showPoints,
  mode,
  baseLayer,
  selection,
  multiIds,
  lineDraft,
  overlays,
  onTap,
  onSelect,
  onToggleMulti,
  onOverlayMove,
  onObjectMove,
  onGroupMove,
  onDraftPointMove,
  onViewScaleChange,
  exportRef,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pinch = useRef<{ dist: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [viewScale, setViewScale] = useState(10)
  const fitted = useRef(false)

  const ref = useMemo(() => polygonCenter(zone), [zone])
  const toCanvas = (p: LatLng) => {
    const m = toLocalMeters(ref, p)
    return { x: m.x, y: -m.y }
  }
  const toGps = (c: { x: number; y: number }): LatLng => fromLocalMeters(ref, { x: c.x, y: -c.y })

  const zoneCanvas = useMemo(() => zone.map(toCanvas), [zone, ref]) // eslint-disable-line react-hooks/exhaustive-deps

  const bbox = useMemo(() => {
    const xs = zoneCanvas.map((p) => p.x)
    const ys = zoneCanvas.map((p) => p.y)
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    }
  }, [zoneCanvas])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Fit the zone once the container size is known
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || fitted.current || !size.width || !size.height) return
    const bw = Math.max(bbox.maxX - bbox.minX, 10)
    const bh = Math.max(bbox.maxY - bbox.minY, 10)
    const scale = Math.min(size.width / bw, size.height / bh) * 0.8
    stage.scale({ x: scale, y: scale })
    stage.position({
      x: size.width / 2 - ((bbox.minX + bbox.maxX) / 2) * scale,
      y: size.height / 2 - ((bbox.minY + bbox.maxY) / 2) * scale,
    })
    stage.batchDraw()
    setViewScale(scale)
    onViewScaleChange?.(scale)
    fitted.current = true
  }, [size, bbox]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyZoom(newScale: number, pointer: { x: number; y: number }) {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const clamped = Math.max(0.2, Math.min(400, newScale))
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    stage.scale({ x: clamped, y: clamped })
    stage.position({ x: pointer.x - mousePointTo.x * clamped, y: pointer.y - mousePointTo.y * clamped })
    stage.batchDraw()
    setViewScale(clamped)
    onViewScaleChange?.(clamped)
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return
    const factor = e.evt.deltaY > 0 ? 1 / 1.09 : 1.09
    applyZoom(stage.scaleX() * factor, pointer)
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches
    const stage = stageRef.current
    if (!stage || touches.length !== 2) return
    e.evt.preventDefault()
    stage.draggable(false)
    const [a, b] = [touches[0], touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const box = stage.container().getBoundingClientRect()
    const center = { x: (a.clientX + b.clientX) / 2 - box.left, y: (a.clientY + b.clientY) / 2 - box.top }
    if (!pinch.current) {
      pinch.current = { dist }
      return
    }
    applyZoom(stage.scaleX() * (dist / pinch.current.dist), center)
    pinch.current = { dist }
  }

  function handleTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) {
      pinch.current = null
      stageRef.current?.draggable(true)
    }
  }

  function handleStageClick() {
    const stage = stageRef.current
    if (!stage || pinch.current) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    if (mode === 'view') onSelect(null)
    else if (mode === 'multi' || mode === 'check') return // empty tap keeps the selection/statuses
    else onTap(toGps(pos))
  }

  const dragStart = useRef<{ x: number; y: number } | null>(null)

  // Export : capture de la vue courante (WYSIWYG) en haute résolution
  useEffect(() => {
    if (!exportRef) return
    exportRef.current = {
      exportImage: (targetWidthPx = 2400) => {
        const stage = stageRef.current
        if (!stage || !stage.width()) return null
        const pixelRatio = Math.max(1, Math.min(6, targetWidthPx / stage.width()))
        return stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
      },
    }
    return () => {
      exportRef.current = null
    }
  }, [exportRef])

  // Map tile background (semi-transparent, to situate the plan on the terrain)
  const tileImages = useRef(new Map<string, HTMLImageElement>())
  const [, setTileTick] = useState(0)
  function getTileImage(url: string): HTMLImageElement | null {
    const cache = tileImages.current
    let img = cache.get(url)
    if (!img) {
      img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      img.onload = () => setTileTick((t) => t + 1)
      cache.set(url, img)
    }
    return img.complete && img.naturalWidth > 0 ? img : null
  }

  const tiles = useMemo(() => {
    if (baseLayer === 'none') return []
    // Zoom level that stays sharp at the current px-per-meter, clamped to what
    // tile servers provide.
    let z = Math.round(Math.log2(156543.03392 * Math.cos((ref.lat * Math.PI) / 180) * viewScale))
    z = Math.max(13, Math.min(19, z))
    const extent = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY)
    const padM = extent * 0.6 + 60 // « un peu plus » que la zone, pour situer le plan
    const nw = toGps({ x: bbox.minX - padM, y: bbox.minY - padM })
    const se = toGps({ x: bbox.maxX + padM, y: bbox.maxY + padM })
    let x0 = 0
    let x1 = 0
    let y0 = 0
    let y1 = 0
    for (;;) {
      x0 = Math.floor(lngToTileX(nw.lng, z))
      x1 = Math.floor(lngToTileX(se.lng, z))
      y0 = Math.floor(latToTileY(nw.lat, z))
      y1 = Math.floor(latToTileY(se.lat, z))
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 120 || z <= 13) break
      z--
    }
    const list: { url: string; x: number; y: number; width: number; height: number }[] = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const a = toCanvas(tileNW(x, y, z))
        const b = toCanvas(tileNW(x + 1, y + 1, z))
        const url =
          baseLayer === 'osm'
            ? `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
            : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
        list.push({ url, x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y })
      }
    }
    return list
  }, [baseLayer, viewScale, bbox, ref]) // eslint-disable-line react-hooks/exhaustive-deps

  // Screen-constant sizes expressed in canvas (meter) units
  const px = (n: number) => n / viewScale
  const step = gridStep(viewScale)
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.35 + step
  const gridLines = useMemo(() => {
    const out: { points: number[]; key: string }[] = []
    const x0 = Math.floor((bbox.minX - pad) / step) * step
    const x1 = bbox.maxX + pad
    const y0 = Math.floor((bbox.minY - pad) / step) * step
    const y1 = bbox.maxY + pad
    for (let x = x0; x <= x1; x += step) out.push({ key: `v${x}`, points: [x, y0, x, y1] })
    for (let y = y0; y <= y1; y += step) out.push({ key: `h${y}`, points: [x0, y, x1, y] })
    return out
  }, [bbox, step, pad])

  const shapesListening = mode === 'view' || mode === 'multi' || mode === 'check'

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none', background: '#0a0f1a' }}>
      <Stage
        ref={stageRef}
        width={size.width || window.innerWidth}
        height={size.height || 400}
        draggable
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer listening={false}>
          {/* Map tiles (transparent background) */}
          {tiles.map((t) => {
            const img = getTileImage(t.url)
            return img ? (
              <KonvaImage key={t.url} image={img} x={t.x} y={t.y} width={t.width} height={t.height} opacity={0.6} />
            ) : null
          })}
          {/* Grid */}
          {gridLines.map((l) => (
            <Line
              key={l.key}
              points={l.points}
              stroke={baseLayer === 'none' ? '#1c2941' : 'rgba(148, 163, 184, 0.45)'}
              strokeWidth={px(1)}
            />
          ))}
          {/* Zone outline */}
          <Line
            points={[...zoneCanvas, zoneCanvas[0]].flatMap((p) => [p.x, p.y])}
            stroke="#a78bfa"
            strokeWidth={px(3)}
            dash={[px(10), px(7)]}
            closed
            fill="rgba(167,139,250,0.05)"
          />
        </Layer>

        <Layer>
          {/* Plans importés géoréférencés (sous tout le reste) */}
          {overlays.map((ov) => {
            const img = getTileImage(ov.url)
            if (!img) return null
            const c = toCanvas(ov.center)
            return (
              <KonvaImage
                key={ov.id}
                image={img}
                x={c.x}
                y={c.y}
                width={ov.widthM}
                height={ov.heightM}
                offsetX={ov.widthM / 2}
                offsetY={ov.heightM / 2}
                rotation={ov.rotation}
                opacity={ov.editing ? Math.max(ov.opacity, 0.5) : ov.opacity}
                listening={ov.editing}
                draggable={ov.editing}
                stroke={ov.editing ? '#38bdf8' : undefined}
                strokeWidth={ov.editing ? px(2) : 0}
                onDragEnd={(e) => onOverlayMove(ov.id, toGps({ x: e.target.x(), y: e.target.y() }))}
              />
            )
          })}

          {/* Lines */}
          {lines
            .filter((l) => visibleLayers.has(l.layer))
            .map((l) => {
              const def = findLineDef(l.layer, l.lineType)
              const selected =
                (selection?.kind === 'line' && selection.id === l.id) || (mode === 'multi' && multiIds.has(l.id))
              const pts = l.points.map(toCanvas)
              const mid = pts[Math.floor((pts.length - 1) / 2)]
              const length = lineLengthMeters(l.points)
              const handleLineTap = (e: Konva.KonvaEventObject<Event>) => {
                e.cancelBubble = true
                if (mode === 'multi' || mode === 'check') onToggleMulti(l.id)
                else onSelect({ kind: 'line', id: l.id })
              }
              return (
                <Group key={l.id} listening={shapesListening}>
                  <Line
                    points={pts.flatMap((p) => [p.x, p.y])}
                    stroke={DISCIPLINE_COLORS[l.layer]}
                    strokeWidth={def?.thicknessM ? Math.max(def.thicknessM, px(3)) : px(selected ? 6 : 4)}
                    hitStrokeWidth={px(22)}
                    dash={def?.dashed ? [px(10), px(8)] : undefined}
                    lineCap="round"
                    lineJoin="round"
                    shadowColor={selected ? '#ffffff' : undefined}
                    shadowBlur={selected ? px(8) : 0}
                    onClick={handleLineTap}
                    onTap={handleLineTap}
                  />
                  <Text
                    text={`${l.status === 'done' || l.status === 'checked' ? '✓ ' : ''}${formatMeters(length)}${def?.unitLengthM ? ` · ${Math.ceil(length / def.unitLengthM)}×` : ''}`}
                    x={mid.x + px(8)}
                    y={mid.y - px(18)}
                    fontSize={px(12)}
                    fill={l.status === 'done' || l.status === 'checked' ? STATUS_COLORS[l.status] : '#e8edf6'}
                    shadowColor="#000"
                    shadowBlur={px(4)}
                    listening={false}
                  />
                </Group>
              )
            })}

          {/* Line draft */}
          {lineDraft.length >= 1 && (
            <Line
              points={lineDraft.map(toCanvas).flatMap((p) => [p.x, p.y])}
              stroke="#ffffff"
              strokeWidth={px(3)}
              dash={[px(10), px(6)]}
              listening={false}
            />
          )}
          {mode === 'line' &&
            lineDraft.map((p, i) => {
              const c = toCanvas(p)
              return (
                <Circle
                  key={i}
                  x={c.x}
                  y={c.y}
                  radius={px(9)}
                  fill="#a78bfa"
                  stroke="#0b1220"
                  strokeWidth={px(2)}
                  draggable
                  onDragEnd={(e) => onDraftPointMove(i, toGps({ x: e.target.x(), y: e.target.y() }))}
                />
              )
            })}

          {/* Objects — render order follows the stacking order (z, plus grand = dessus) */}
          {[...objects]
            .sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.createdAt - b.createdAt)
            .filter((o) => visibleLayers.has(o.layer))
            .map((o) => {
              const view = objectView(o)
              const color = view.color
              const inMulti = mode === 'multi' && multiIds.has(o.id)
              const selected = (selection?.kind === 'object' && selection.id === o.id) || inMulti
              const c = toCanvas(o.center)
              const isPoint = view.isPoint
              const w = isPoint ? px(24) : o.widthM
              const h = isPoint ? px(24) : o.heightM
              const handleObjectTap = (e: Konva.KonvaEventObject<Event>) => {
                e.cancelBubble = true
                if (mode === 'multi' || mode === 'check') onToggleMulti(o.id)
                else onSelect({ kind: 'object', id: o.id })
              }
              return (
                <Group
                  key={o.id}
                  x={c.x}
                  y={c.y}
                  rotation={o.rotation}
                  draggable={mode === 'view' || inMulti}
                  listening={shapesListening}
                  onDragStart={(e) => {
                    dragStart.current = { x: e.target.x(), y: e.target.y() }
                  }}
                  onDragEnd={(e) => {
                    if (mode === 'multi') {
                      const start = dragStart.current
                      dragStart.current = null
                      if (!start) return
                      const dx = e.target.x() - start.x
                      const dy = e.target.y() - start.y
                      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return
                      onGroupMove(dx, -dy)
                    } else {
                      onObjectMove(o.id, toGps({ x: e.target.x(), y: e.target.y() }))
                    }
                  }}
                  onClick={handleObjectTap}
                  onTap={handleObjectTap}
                >
                  {isPoint ? (
                    <Circle radius={w / 2} fill={color} stroke={selected ? '#fff' : '#0b1220'} strokeWidth={px(selected ? 3 : 1.5)} />
                  ) : (
                    <Rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      fill={color}
                      opacity={0.55}
                      stroke={selected ? '#fff' : color}
                      strokeWidth={px(selected ? 3 : 2)}
                      cornerRadius={Math.min(0.3, w / 8)}
                    />
                  )}
                  <Text
                    text={view.glyph}
                    fontSize={isPoint ? px(10) : Math.max(Math.min(w, h) * 0.4, px(9))}
                    fontStyle="bold"
                    fill={isPoint ? '#0b1220' : '#e8edf6'}
                    width={w}
                    height={h}
                    offsetX={w / 2}
                    offsetY={h / 2}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                  {o.label && (
                    <Text
                      text={o.label}
                      fontSize={px(12)}
                      fill="#e8edf6"
                      y={h / 2 + px(4)}
                      width={px(160)}
                      x={-px(80)}
                      align="center"
                      shadowColor="#000"
                      shadowBlur={px(4)}
                      listening={false}
                    />
                  )}
                  {(o.status === 'done' || o.status === 'checked') && (
                    <Group x={w / 2} y={-h / 2} listening={false}>
                      <Circle radius={px(8)} fill={STATUS_COLORS[o.status]} stroke="#0b1220" strokeWidth={px(1.5)} />
                      <Text
                        text="✓"
                        fontSize={px(11)}
                        fontStyle="bold"
                        fill="#0b1220"
                        width={px(16)}
                        height={px(16)}
                        offsetX={px(8)}
                        offsetY={px(8)}
                        align="center"
                        verticalAlign="middle"
                      />
                    </Group>
                  )}
                </Group>
              )
            })}

          {/* GPS reference points projected on the plan */}
          {showPoints &&
            points.map((p) => {
              const c = toCanvas({ lat: p.lat, lng: p.lng })
              return (
                <Group key={p.id} x={c.x} y={c.y} listening={false}>
                  <Circle radius={px(7)} fill={POINT_CATEGORY_COLORS[p.category]} stroke="#0b1220" strokeWidth={px(1.5)} />
                  <Text
                    text={p.label}
                    fontSize={px(11)}
                    fill="#e8edf6"
                    x={px(10)}
                    y={-px(6)}
                    shadowColor="#000"
                    shadowBlur={px(4)}
                  />
                </Group>
              )
            })}
        </Layer>
      </Stage>
    </div>
  )
}
