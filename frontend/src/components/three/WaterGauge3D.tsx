import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { num } from '../../lib/format'
import { PRESET, useQuality } from '../../lib/quality'
import { prefersReducedMotion } from '../../lib/webgl'
import Label3D from './Label3D'
import Ticker, { PerfGuard } from './Ticker'

const R = 1.25      // raio do cilindro
const H = 4.2       // altura útil (escala completa)

/** Escala "bonita": 0–2 m ou 0–N m (igual ao gráfico 2D). */
export const gaugeMax = (v: number) => (v <= 1.6 ? 2 : Math.ceil(v * 1.25))

function Liquid({ target, animate }: { target: number; animate: boolean }) {
  const body = useRef<THREE.Mesh>(null)
  const top = useRef<THREE.Mesh>(null)
  const h = useRef(0.001)
  const topGeo = useMemo(() => new THREE.CircleGeometry(R * 0.985, 72, 0, Math.PI * 2), [])
  const base = useMemo(() => Float32Array.from(topGeo.attributes.position.array), [topGeo])
  const still = useRef(prefersReducedMotion())
  useFrame(({ clock }) => {
    h.current = animate ? h.current + (target - h.current) * 0.05 : target   // sobe/desce suavemente (modo Alto) ou direto
    const hh = Math.max(0.001, h.current)
    if (body.current) { body.current.scale.y = hh; body.current.position.y = hh / 2 }
    if (top.current) {
      top.current.position.y = hh
      if (animate && !still.current) {
        const p = topGeo.attributes.position
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1]
          p.setZ(i, Math.sin(x * 2.4 + clock.elapsedTime * 2) * 0.035 + Math.cos(y * 2.8 + clock.elapsedTime * 1.6) * 0.03)
        }
        p.needsUpdate = true
        topGeo.computeVertexNormals()
      }
    }
  })
  return (
    <>
      <mesh ref={body}>
        <cylinderGeometry args={[R * 0.985, R * 0.985, 1, 72, 1, true]} />
        <meshPhysicalMaterial color="#2a9df4" transparent opacity={0.82} roughness={0.08} metalness={0} clearcoat={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={top} rotation={[-Math.PI / 2, 0, 0]} geometry={topGeo}>
        <meshPhysicalMaterial color="#7fd0ff" transparent opacity={0.9} roughness={0.05} clearcoat={1} emissive="#1d7fe0" emissiveIntensity={0.25} />
      </mesh>
    </>
  )
}

function Ticks({ max }: { max: number }) {
  const marks = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i)
  const step = H / max
  return (
    <>
      {marks.map((m) => (
        <group key={m} position={[0, m * step, 0]}>
          <mesh position={[-R - 0.16, 0, 0]}><boxGeometry args={[0.32, 0.035, 0.035]} /><meshStandardMaterial color="#dff0ff" emissive="#9fd0ff" emissiveIntensity={0.6} /></mesh>
          <Label3D position={[-R - 0.95, 0, 0]} variant="tick" size={0.034} lines={[`${m} m`]} />
        </group>
      ))}
    </>
  )
}

export default function WaterGauge3D({ level, height = 340 }: { level: number | null | undefined; height?: number }) {
  const value = typeof level === 'number' ? level : 0
  const max = gaugeMax(value)
  const fill = Math.min(1, value / max) * H
  const spin = useRef(!prefersReducedMotion())
  const quality = useQuality()
  const P = PRESET[quality === 'high' ? 'high' : 'low']
  return (
    <div className="canvas-wrap" style={{ height }}>
      <Canvas key={quality} frameloop="demand" dpr={P.dpr} camera={{ position: [5.4, 3.0, 7.0], fov: 38 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}>
        <Ticker fps={P.fps} active />
        <PerfGuard enabled={quality === 'high'} />
        <color attach="background" args={['#0b2a5b']} />
        <ambientLight intensity={P.env ? 0.5 : 1.1} />
        <directionalLight position={[5, 8, 4]} intensity={2} />
        <pointLight position={[-4, 2, -3]} intensity={30} color="#38a8f5" />
        {P.env && <Environment resolution={256}>
          <Lightformer form="rect" intensity={4} position={[0, 6, 4]} scale={[10, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={2.5} position={[-6, 2, -2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#9fd0ff" />
          <Lightformer form="ring" intensity={2} position={[5, 3, -4]} scale={4} color="#ffd9a0" />
        </Environment>}

        <group position={[0, -H / 2, 0]}>
          {/* base metálica */}
          <mesh position={[0, -0.18, 0]}><cylinderGeometry args={[R + 0.35, R + 0.5, 0.36, 72]} /><meshStandardMaterial color="#10264d" metalness={0.9} roughness={0.28} /></mesh>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[R, 72]} /><meshStandardMaterial color="#0a1c3d" metalness={0.6} roughness={0.4} /></mesh>
          <Liquid target={fill} animate={P.fps > 0} />
          {/* tubo de vidro */}
          <mesh position={[0, H / 2 + 0.1, 0]}>
            <cylinderGeometry args={[R, R, H + 0.2, 72, 1, true]} />
            <meshPhysicalMaterial color="#e8f6ff" transparent opacity={0.16} roughness={0.02} metalness={0} clearcoat={1} clearcoatRoughness={0.03} envMapIntensity={2.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, H + 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[R, 0.045, 16, 72]} /><meshStandardMaterial color="#cfe6ff" metalness={1} roughness={0.2} /></mesh>
          <Ticks max={max} />
          <Label3D position={[0, Math.max(fill, 0.1) + 0.75, 0]} variant="tip" size={0.05} lines={[level == null ? '—' : `${num(value)} m`]} />
        </group>
        <OrbitControls enablePan={false} enableZoom={false} autoRotate={spin.current && P.spin} autoRotateSpeed={0.9} minPolarAngle={0.9} maxPolarAngle={1.65} />
      </Canvas>
    </div>
  )
}
