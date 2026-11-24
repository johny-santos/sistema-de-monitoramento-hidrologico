import { Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import type { Metric, Series } from '../../lib/api'
import { dayHour, hour, num } from '../../lib/format'
import { PRESET, useQuality } from '../../lib/quality'
import { prefersReducedMotion } from '../../lib/webgl'
import Label3D from './Label3D'
import Ticker, { PerfGuard } from './Ticker'

const W = 11, H = 4.2, D = 1.7

interface P { label: string; value: number }

function usable(series: Series): P[] {
  return series.points
    .filter((p): p is typeof p & { value: number } => p.value != null)
    .map((p) => ({ value: p.value, label: series.hours > 24 ? dayHour(p.observed_at) : hour(p.observed_at) + ' · ' + new Date(p.observed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }))
}

function range(vals: number[], metric: Metric) {
  const min = Math.min(...vals), max = Math.max(...vals)
  if (metric === 'rain') return { lo: 0, hi: Math.max(1, Math.ceil(max * 1.15)) }
  const lo = Math.max(0, Math.floor((min - 0.25) * 4) / 4)
  return { lo, hi: Math.max(Math.ceil((max + 0.25) * 4) / 4, lo + 1) }
}

function Tip({ x, y, z, label, value, unit }: { x: number; y: number; z: number; label: string; value: number; unit: string }) {
  return (
    <Label3D position={[x, y + 0.7, z]} variant="tip" size={0.05} lines={[`${num(value, unit === 'm' ? 2 : 1)} ${unit}`, label]} />
  )
}

/** Nível: superfície de água extrudada em vidro azul, com linha luminosa no topo. */
function LevelSurface({ pts, lo, hi }: { pts: P[]; lo: number; hi: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = pts.length
  const xs = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * W - W / 2)
  const ys = (v: number) => ((v - lo) / (hi - lo)) * H

  const { geo, tube } = useMemo(() => {
    const curve = new THREE.SplineCurve(pts.map((p, i) => new THREE.Vector2(xs(i), ys(p.value))))
    const sampled = curve.getPoints(Math.max(60, n * 6))
    const shape = new THREE.Shape()
    shape.moveTo(sampled[0].x, 0)
    sampled.forEach((s) => shape.lineTo(s.x, Math.max(0.02, s.y)))
    shape.lineTo(sampled[sampled.length - 1].x, 0)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 1 })
    geo.translate(0, 0, -D / 2)
    const path = new THREE.CatmullRomCurve3(sampled.map((s) => new THREE.Vector3(s.x, s.y, D / 2 + 0.06)))
    return { geo, tube: new THREE.TubeGeometry(path, sampled.length, 0.05, 8, false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, lo, hi])

  const onMove = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    e.stopPropagation()
    setHover(Math.min(n - 1, Math.max(0, Math.round(((e.point.x + W / 2) / W) * (n - 1)))))
  }
  return (
    <group>
      <mesh geometry={geo} onPointerMove={onMove} onPointerOut={() => setHover(null)}>
        <meshPhysicalMaterial color="#2a8cf0" roughness={0.12} metalness={0.05} clearcoat={1} transmission={0.25} thickness={1.2} ior={1.33} transparent opacity={0.92} envMapIntensity={1.6} />
      </mesh>
      <mesh geometry={tube}><meshStandardMaterial color="#bfe7ff" emissive="#4fb8ff" emissiveIntensity={1.2} /></mesh>
      {hover != null && (
        <>
          <mesh position={[xs(hover), ys(pts[hover].value), D / 2 + 0.08]}><sphereGeometry args={[0.13, 20, 20]} /><meshStandardMaterial color="#0a2a5e" emissive="#ffffff" emissiveIntensity={0.7} /></mesh>
          <Tip x={xs(hover)} y={ys(pts[hover].value)} z={D / 2} label={pts[hover].label} value={pts[hover].value} unit="m" />
        </>
      )}
    </group>
  )
}

/** Chuva: colunas 3D, cor pela intensidade. */
function RainBars({ pts, hi, unit = 'mm/h' }: { pts: P[]; hi: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = pts.length
  const step = n === 1 ? W : W / (n - 1)
  const bw = Math.min(0.5, step * 0.62)
  const color = (t: number) => new THREE.Color().lerpColors(new THREE.Color('#5cc3ff'), new THREE.Color('#0a4fb3'), Math.min(1, t))
  return (
    <group>
      {pts.map((p, i) => {
        const h = Math.max(0.03, (p.value / hi) * H)
        const x = n === 1 ? 0 : (i / (n - 1)) * W - W / 2
        return (
          <mesh key={i} position={[x, h / 2, 0]} scale={hover === i ? [1.25, 1, 1.25] : 1}
            onPointerOver={(e) => { e.stopPropagation(); setHover(i) }} onPointerOut={() => setHover(null)}>
            <boxGeometry args={[bw, h, Math.min(1.1, D * 0.6)]} />
            <meshPhysicalMaterial color={hover === i ? '#0a2a5e' : color(p.value / hi)} roughness={0.15} clearcoat={1} envMapIntensity={1.4} />
          </mesh>
        )
      })}
      {hover != null && <Tip x={n === 1 ? 0 : (hover / (n - 1)) * W - W / 2} y={Math.max(0.03, (pts[hover].value / hi) * H)} z={0} label={pts[hover].label} value={pts[hover].value} unit={unit} />}
    </group>
  )
}

export default function Chart3D({ series, metric, height = 380 }: { series: Series; metric: Metric; height?: number }) {
  const pts = useMemo(() => usable(series), [series])
  const { lo, hi } = useMemo(() => range(pts.map((p) => p.value), metric), [pts, metric])
  const unit = metric === 'level' ? 'm' : 'mm/h'
  const quality = useQuality()
  const P = PRESET[quality === 'high' ? 'high' : 'low']
  const ticks = 5
  return (
    <div className="canvas-wrap chart3d" style={{ height }}>
      <Canvas key={quality} frameloop="demand" dpr={P.dpr} camera={{ position: [3, 6.4, 12], fov: 36 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}>
        <Ticker fps={P.fps} active />
        <PerfGuard enabled={quality === 'high'} />
        <color attach="background" args={['#0b2a5b']} />
        <fog attach="fog" args={['#0b2a5b', 18, 38]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 9, 6]} intensity={2.2} />
        {P.env && <Environment resolution={256}>
          <Lightformer form="rect" intensity={4} position={[0, 6, 5]} scale={[12, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={2} position={[-7, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#8fc8ff" />
        </Environment>}
        <group position={[0, -H / 2, 0]}>
          <Grid position={[0, -0.01, 0]} args={[W + 3, 6]} cellSize={0.5} cellThickness={0.6} cellColor="#1c4b8f" sectionSize={2} sectionThickness={1.2} sectionColor="#3b86e0" fadeDistance={26} fadeStrength={1.5} />
          {Array.from({ length: ticks }, (_, i) => {
            const t = i / (ticks - 1)
            return <Label3D key={i} position={[-W / 2 - 1.1, t * H, 0]} variant="tick" size={0.036} lines={[`${num(lo + t * (hi - lo), metric === 'level' ? 2 : 1)} ${unit}`]} />
          })}
          {pts.length > 0 && (metric === 'level' && pts.length >= 3 ? <LevelSurface pts={pts} lo={lo} hi={hi} /> : <RainBars pts={pts} hi={hi} unit={unit} />)}
        </group>
        <OrbitControls enablePan={false} enableDamping minDistance={7} maxDistance={22} minPolarAngle={0.5} maxPolarAngle={1.5} autoRotate={P.spin && !prefersReducedMotion()} autoRotateSpeed={0.5} />
      </Canvas>
      <span className="hint3d">Arraste para girar · role para aproximar · passe o mouse nos dados</span>
    </div>
  )
}
