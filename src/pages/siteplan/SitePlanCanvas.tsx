import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import type { Discipline, GeoPoint, LatLng, SiteLine, SiteObject } from '../../types'
import { DISCIPLINE_COLORS, POINT_CATEGORY_COLORS } from '../../types'
import { findLineDef, findObjectDef } from '../../utils/catalog'
import { formatMeters, fromLocalMeters, lineLengthMeters, polygonCenter, toLocalMeters } from '../../utils/geo'

export type SitePlanMode = 'view' | 'place' | 'line'

export type SiteSelection = { kind: 'object'; id: string } | { kind: 'line'; id: string } | null

interface Props {
  zone: LatLng[]
  objects: SiteObject[]
  lines: SiteLine[]
  points: GeoPoint[]
  visibleLayers: Set<Discipline>
  showPoints: boolean
  mode: SitePlanMode
  selection: SiteSelection
  lineDraft: LatLng[]
  onTap: (gps: LatLng) => void
  onSelect: (sel: SiteSelection) => void
  onObjectMove: (id: string, gps: LatLng) => void
  onDraftPointMove: (index: number, gps: LatLng) => void
}

/** Pick a grid step so cells stay readable at the current zoom. */
function gridStep(viewScale: number): number {
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200]
  for (const s of steps) if (s * viewScale >= 42) return s
  return 500
}

export default function SitePlanCanvas({
  zone,
  objects,
  lines,
  points,
  visibleLayers,
  showPoints,
  mode,
  selection,
  lineDraft,
  onTap,
  onSelect,
  onObjectMove,
  onDraftPointMove,
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
    fitted.current = true
  }, [size, bbox])

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
    else onTap(toGps(pos))
  }

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

  const shapesListening = mode === 'view'

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
          {/* Grid */}
          {gridLines.map((l) => (
            <Line key={l.key} points={l.points} stroke="#1c2941" strokeWidth={px(1)} />
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
          {/* Lines */}
          {lines
            .filter((l) => visibleLayers.has(l.layer))
            .map((l) => {
              const def = findLineDef(l.layer, l.lineType)
              const selected = selection?.kind === 'line' && selection.id === l.id
              const pts = l.points.map(toCanvas)
              const mid = pts[Math.floor((pts.length - 1) / 2)]
              const length = lineLengthMeters(l.points)
              return (
                <Group key={l.id} listening={shapesListening}>
                  <Line
                    points={pts.flatMap((p) => [p.x, p.y])}
                    stroke={DISCIPLINE_COLORS[l.layer]}
                    strokeWidth={px(selected ? 6 : 4)}
                    hitStrokeWidth={px(22)}
                    dash={def?.dashed ? [px(10), px(8)] : undefined}
                    lineCap="round"
                    lineJoin="round"
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelect({ kind: 'line', id: l.id })
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onSelect({ kind: 'line', id: l.id })
                    }}
                  />
                  <Text
                    text={`${formatMeters(length)}${def?.unitLengthM ? ` · ${Math.ceil(length / def.unitLengthM)}×` : ''}`}
                    x={mid.x + px(8)}
                    y={mid.y - px(18)}
                    fontSize={px(12)}
                    fill="#e8edf6"
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

          {/* Objects */}
          {objects
            .filter((o) => visibleLayers.has(o.layer))
            .map((o) => {
              const def = findObjectDef(o.layer, o.symbolType)
              const color = DISCIPLINE_COLORS[o.layer]
              const selected = selection?.kind === 'object' && selection.id === o.id
              const c = toCanvas(o.center)
              const isPoint = def?.point ?? false
              const w = isPoint ? px(24) : o.widthM
              const h = isPoint ? px(24) : o.heightM
              return (
                <Group
                  key={o.id}
                  x={c.x}
                  y={c.y}
                  rotation={o.rotation}
                  draggable={mode === 'view'}
                  listening={shapesListening}
                  onDragEnd={(e) => onObjectMove(o.id, toGps({ x: e.target.x(), y: e.target.y() }))}
                  onClick={(e) => {
                    e.cancelBubble = true
                    onSelect({ kind: 'object', id: o.id })
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onSelect({ kind: 'object', id: o.id })
                  }}
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
                    text={def?.glyph ?? '?'}
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
