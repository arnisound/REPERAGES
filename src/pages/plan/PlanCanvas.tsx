import { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Layer, Line, RegularPolygon, Rect, Stage, Text } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import type { Discipline, PlanConnection, PlanObject } from '../../types'
import { DISCIPLINE_COLORS } from '../../types'
import { SYMBOL_CATALOG } from '../../utils/symbols'

export type CanvasMode = 'view' | 'calibrate' | 'place' | 'cable'

interface Props {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  objects: PlanObject[]
  connections: PlanConnection[]
  visibleLayers: Set<Discipline>
  mode: CanvasMode
  selectedObjectId: string | null
  selectedConnectionId: string | null
  calibrationPoints: { x: number; y: number }[]
  cableDraftPoints: { x: number; y: number }[]
  onCanvasTap: (point: { x: number; y: number }, hitObjectId: string | null) => void
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onSelectObject: (id: string) => void
  onSelectConnection: (id: string) => void
}

function symbolShape(obj: PlanObject) {
  const def = SYMBOL_CATALOG[obj.layer].find((s) => s.type === obj.symbolType)
  return def
}

export default function PlanCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  objects,
  connections,
  visibleLayers,
  mode,
  selectedObjectId,
  selectedConnectionId,
  calibrationPoints,
  cableDraftPoints,
  onCanvasTap,
  onObjectDragEnd,
  onSelectObject,
  onSelectConnection,
}: Props) {
  const [image] = useImage(imageUrl)
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pinch = useRef<{ dist: number; center: { x: number; y: number } } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const fitted = useRef(false)

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

  // Fit image to container once it's known
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || fitted.current || !imageWidth || !imageHeight || !size.width || !size.height) return
    const scale = Math.min(size.width / imageWidth, size.height / imageHeight) * 0.95
    stage.scale({ x: scale, y: scale })
    stage.position({ x: (size.width - imageWidth * scale) / 2, y: (size.height - imageHeight * scale) / 2 })
    stage.batchDraw()
    fitted.current = true
  }, [imageWidth, imageHeight, size])

  function getTouchDist(touches: TouchList) {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  function getTouchCenter(touches: TouchList) {
    const [a, b] = [touches[0], touches[1]]
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches
    const stage = stageRef.current
    if (!stage) return
    if (touches.length === 2) {
      e.evt.preventDefault()
      stage.draggable(false)
      const dist = getTouchDist(touches)
      const center = getTouchCenter(touches)
      if (!pinch.current) {
        pinch.current = { dist, center }
        return
      }
      const oldScale = stage.scaleX()
      const scaleBy = dist / pinch.current.dist
      const newScale = Math.max(0.05, Math.min(8, oldScale * scaleBy))

      const box = stage.container().getBoundingClientRect()
      const pointer = { x: center.x - box.left, y: center.y - box.top }
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      stage.scale({ x: newScale, y: newScale })
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
      stage.batchDraw()
      pinch.current = { dist, center }
    }
  }

  function handleTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) {
      pinch.current = null
      stageRef.current?.draggable(true)
    }
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const scaleBy = 1.08
    const newScale = Math.max(0.05, Math.min(8, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy))
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
    stage.batchDraw()
  }

  function handleStageClick() {
    const stage = stageRef.current
    if (!stage) return
    // ignore click that ended a drag/pinch
    if (pinch.current) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    // Object taps are handled by each object's own onClick/onTap (with cancelBubble),
    // so a click reaching the stage is always on empty canvas / the background image.
    onCanvasTap(pos, null)
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none', background: '#0a0f1a' }}>
      <Stage
        ref={stageRef}
        width={size.width || window.innerWidth}
        height={size.height || 400}
        draggable={mode === 'view' || mode === 'cable'}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {image && <KonvaImage image={image} width={imageWidth} height={imageHeight} />}

          {/* Connections */}
          {connections
            .filter((c) => visibleLayers.has(c.layer))
            .map((c) => {
              const pts = c.points.flatMap((p) => [p.x, p.y])
              return (
                <Line
                  key={c.id}
                  points={pts}
                  stroke={DISCIPLINE_COLORS[c.layer]}
                  strokeWidth={c.id === selectedConnectionId ? 5 : 3}
                  hitStrokeWidth={20}
                  lineCap="round"
                  lineJoin="round"
                  onClick={(e) => {
                    e.cancelBubble = true
                    onSelectConnection(c.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onSelectConnection(c.id)
                  }}
                />
              )
            })}

          {/* Cable draft preview */}
          {cableDraftPoints.length > 0 && (
            <Line
              points={cableDraftPoints.flatMap((p) => [p.x, p.y])}
              stroke="#ffffff"
              strokeWidth={3}
              dash={[10, 6]}
              lineCap="round"
            />
          )}

          {/* Calibration points/line */}
          {calibrationPoints.length > 0 && (
            <>
              {calibrationPoints.length === 2 && (
                <Line points={calibrationPoints.flatMap((p) => [p.x, p.y])} stroke="#facc15" strokeWidth={3} dash={[8, 6]} />
              )}
              {calibrationPoints.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={8} fill="#facc15" stroke="#0b1220" strokeWidth={2} />
              ))}
            </>
          )}

          {/* Objects */}
          {objects
            .filter((o) => visibleLayers.has(o.layer))
            .map((o) => {
              const def = symbolShape(o)
              const color = DISCIPLINE_COLORS[o.layer]
              const selected = o.id === selectedObjectId
              const size = 22
              return (
                <Group
                  key={o.id}
                  x={o.x}
                  y={o.y}
                  rotation={o.rotation}
                  draggable={mode === 'view'}
                  onDragEnd={(e) => onObjectDragEnd(o.id, e.target.x(), e.target.y())}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (mode === 'view') onSelectObject(o.id)
                    else onCanvasTap({ x: o.x, y: o.y }, o.id)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    if (mode === 'view') onSelectObject(o.id)
                    else onCanvasTap({ x: o.x, y: o.y }, o.id)
                  }}
                >
                  {def?.shape === 'circle' && (
                    <Circle radius={size / 2} fill={color} stroke={selected ? '#fff' : '#0b1220'} strokeWidth={selected ? 3 : 1.5} data-object-id={o.id} />
                  )}
                  {def?.shape === 'square' && (
                    <Rect x={-size / 2} y={-size / 2} width={size} height={size} fill={color} stroke={selected ? '#fff' : '#0b1220'} strokeWidth={selected ? 3 : 1.5} cornerRadius={3} data-object-id={o.id} />
                  )}
                  {def?.shape === 'triangle' && (
                    <RegularPolygon sides={3} radius={size / 1.6} fill={color} stroke={selected ? '#fff' : '#0b1220'} strokeWidth={selected ? 3 : 1.5} data-object-id={o.id} />
                  )}
                  {def?.shape === 'diamond' && (
                    <RegularPolygon sides={4} radius={size / 1.6} rotation={45} fill={color} stroke={selected ? '#fff' : '#0b1220'} strokeWidth={selected ? 3 : 1.5} data-object-id={o.id} />
                  )}
                  <Text
                    text={def?.glyph ?? '?'}
                    fontSize={9}
                    fill="#0b1220"
                    width={size}
                    height={size}
                    offsetX={size / 2}
                    offsetY={size / 2}
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                  {o.label && (
                    <Text
                      text={o.label}
                      fontSize={11}
                      fill="#fff"
                      y={size / 2 + 4}
                      offsetX={0}
                      align="center"
                      width={120}
                      x={-60}
                      shadowColor="#000"
                      shadowBlur={4}
                      shadowOpacity={0.9}
                      listening={false}
                    />
                  )}
                </Group>
              )
            })}
        </Layer>
      </Stage>
    </div>
  )
}
