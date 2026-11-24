import { OrbitControls, Sky, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import type { Station } from '../../lib/api'
import { num } from '../../lib/format'
import { PRESET, useQuality } from '../../lib/quality'
import { fbm, heightAt, rng, smooth, riverX, stationSpot, TERRAIN_SIZE } from '../../lib/terrain'
import { prefersReducedMotion } from '../../lib/webgl'
import Label3D from './Label3D'
import Ticker, { PerfGuard } from './Ticker'

const SUN = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(74), THREE.MathUtils.degToRad(140))
const waterY = (level: number) => THREE.MathUtils.clamp((level - 1.1) * 1.4, -0.6, 1.2)

/* ---------- Terreno com cores por altitude ---------- */
function Terrain({ seg }: { seg: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const sand = new THREE.Color('#c8b88a'), grass = new THREE.Color('#6aa24a'), forest = new THREE.Color('#3f7d3c')
    const rock = new THREE.Color('#a39a8b'), snow = new THREE.Color('#f2f6f9'), mud = new THREE.Color('#7a6a4c')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = heightAt(x, z)
      pos.setY(i, h)
      const n = fbm(x * 0.09 + 40, z * 0.09, 3)
      c.copy(mud).lerp(sand, smooth(-1.2, 0.2, h))
      c.lerp(grass, smooth(0.2, 1.8, h))
      c.lerp(forest, smooth(2.5, 9, h) * (0.5 + n * 0.55))
      c.lerp(rock, smooth(22, 32, h + n * 8))
      c.lerp(snow, smooth(36, 42, h + n * 4))
      const shade = 0.9 + n * 0.28
      colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [seg])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  )
}

/* ---------- Árvores instanciadas ---------- */
function Trees({ count }: { count: number }) {
  const cones = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const r = rng(7)
    const out: { x: number; y: number; z: number; s: number; tone: number }[] = []
    for (let i = 0; i < count * 6 && out.length < count; i++) {
      const x = (r() - 0.5) * (TERRAIN_SIZE - 20), z = (r() - 0.5) * (TERRAIN_SIZE - 20)
      const h = heightAt(x, z)
      const d = Math.abs(x - riverX(z))
      if (d < 22 || h < 0.8 || h > 20) continue   // deixa as margens livres para casas e estações
      if (fbm(x * 0.05, z * 0.05, 3) < 0.42) continue
      out.push({ x, y: h, z, s: 0.6 + r() * 0.8, tone: r() })
    }
    return out
  }, [count])
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color()
    spots.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s, t.s))
      cones.current?.setMatrixAt(i, m)
      trunks.current?.setMatrixAt(i, m)
      cones.current?.setColorAt(i, col.setHSL(0.3 + t.tone * 0.05, 0.5, 0.17 + t.tone * 0.12))
    })
    for (const ref of [cones, trunks]) if (ref.current) ref.current.instanceMatrix.needsUpdate = true
    if (cones.current?.instanceColor) cones.current.instanceColor.needsUpdate = true
  }, [spots])
  return (
    <>
      <instancedMesh key={`c${spots.length}`} ref={cones} args={[undefined, undefined, spots.length]}>
        <coneGeometry args={[1.5, 5.2, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`t${spots.length}`} ref={trunks} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[0.18, 0.28, 1.2, 5]} />
        <meshStandardMaterial color="#4a3320" roughness={1} />
      </instancedMesh>
    </>
  )
}

/* ---------- Vilarejo: casinhas instanciadas nas margens ---------- */
function Village({ count }: { count: number }) {
  const walls = useRef<THREE.InstancedMesh>(null)
  const roofs = useRef<THREE.InstancedMesh>(null)
  const homes = useMemo(() => {
    const r = rng(33)
    const out: { x: number; y: number; z: number; s: number; rot: number; tone: number }[] = []
    for (let i = 0; i < 400 && out.length < count; i++) {
      const z = (r() - 0.5) * 150
      const side = r() < 0.5 ? -1 : 1
      const x = riverX(z) + side * (24 + r() * 14)
      const h = heightAt(x, z)
      if (h < 0.5 || h > 9) continue
      out.push({ x, y: h, z, s: 0.8 + r() * 0.5, rot: r() * Math.PI, tone: r() })
    }
    return out
  }, [count])
  useEffect(() => {
    const m = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), qr = new THREE.Quaternion()
    const quarter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0))
    homes.forEach((h, i) => {
      q.setFromEuler(new THREE.Euler(0, h.rot, 0))
      m.compose(new THREE.Vector3(h.x, h.y + 1.1 * h.s, h.z), q, new THREE.Vector3(h.s, h.s, h.s)); walls.current?.setMatrixAt(i, m)
      qr.copy(q).multiply(quarter)
      m.compose(new THREE.Vector3(h.x, h.y + 2.9 * h.s, h.z), qr, new THREE.Vector3(h.s, h.s, h.s)); roofs.current?.setMatrixAt(i, m)
      walls.current?.setColorAt(i, col.set(['#f1e6cf', '#e9d9b8', '#f6efe0', '#dfe9f2'][Math.floor(h.tone * 4) % 4]))
      roofs.current?.setColorAt(i, col.set(['#b5523b', '#9c4632', '#c0663f', '#7d4a3a'][Math.floor(h.tone * 4) % 4]))
    })
    for (const ref of [walls, roofs]) {
      if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true }
    }
  }, [homes])
  return (
    <>
      <instancedMesh key={`w${homes.length}`} ref={walls} args={[undefined, undefined, homes.length]}>
        <boxGeometry args={[3, 2.2, 2.6]} /><meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`r${homes.length}`} ref={roofs} args={[undefined, undefined, homes.length]}>
        <coneGeometry args={[2.7, 1.6, 4]} /><meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </>
  )
}

/* ---------- Água ---------- */
function River({ level, mirror }: { level: number; mirror: number }) {
  const normals = useTexture('/img/waternormals.jpg')
  const scene = useThree((s) => s.scene)
  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    return new Water(new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE), {
      textureWidth: mirror, textureHeight: mirror, waterNormals: normals,
      sunDirection: SUN.clone(), sunColor: 0xfff4e0, waterColor: 0x0f4d63, distortionScale: 2.6,
      fog: scene.fog !== undefined,
    })
  }, [normals, scene, mirror])
  useEffect(() => {
    water.rotation.x = -Math.PI / 2
    water.material.uniforms.size.value = 2.2
  }, [water])
  useEffect(() => () => { water.geometry.dispose(); water.material.dispose() }, [water])
  const still = useRef(prefersReducedMotion())
  useFrame((_, dt) => {
    if (!still.current) water.material.uniforms.time.value += dt * 0.55
    water.position.y = THREE.MathUtils.lerp(water.position.y, waterY(level), 0.05)
  })
  return <primitive object={water} />
}

/** Água simples (modo Leve): um plano com mapa de normais. Sem reflexo em tempo real. */
function RiverSimple({ level }: { level: number }) {
  const base = useTexture('/img/waternormals.jpg')
  const normals = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(38, 38)
    t.needsUpdate = true
    return t
  }, [base])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterY(level), 0]}>
      <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE]} />
      <meshStandardMaterial color="#2b86a6" roughness={0.14} metalness={0.25} normalMap={normals} normalScale={new THREE.Vector2(0.55, 0.55)} />
    </mesh>
  )
}

/* ---------- Chuva: no modo Leve é desenhada uma única vez (estática) ---------- */
function Rain({ intensity, N, animate }: { intensity: number; N: number; animate: boolean }) {
  const ref = useRef<THREE.LineSegments>(null)
  const data = useMemo(() => {
    const r = rng(21)
    const pos = new Float32Array(N * 6)
    const speed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 150, y = r() * 70, z = (r() - 0.5) * 150
      pos.set([x, y, z, x - 0.12, y + 1.6, z], i * 6)
      speed[i] = 38 + r() * 22
    }
    return { pos, speed }
  }, [N])
  const count = Math.min(N, Math.round(Math.min(1, intensity / 2) * N))
  useEffect(() => { if (ref.current) { ref.current.visible = count > 0; ref.current.geometry.setDrawRange(0, count * 2) } }, [count])
  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh || !animate || count === 0) return
    const p = data.pos
    for (let i = 0; i < count; i++) {
      const dy = data.speed[i] * dt
      p[i * 6 + 1] -= dy; p[i * 6 + 4] -= dy
      if (p[i * 6 + 1] < 0) { p[i * 6 + 1] += 70; p[i * 6 + 4] += 70 }
    }
    mesh.geometry.attributes.position.needsUpdate = true
  })
  return (
    <lineSegments key={N} ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#cfe6ff" transparent opacity={0.4} depthWrite={false} />
    </lineSegments>
  )
}

/* ---------- Estação hidrológica: casinha + torre com antena + pier + régua no rio ---------- */
const M = {
  wall: new THREE.MeshStandardMaterial({ color: '#f4ecd9', roughness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ color: '#b3503a', roughness: 0.75 }),
  door: new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: '#8fd0ff', roughness: 0.2, metalness: 0.3, emissive: '#2a7fc0', emissiveIntensity: 0.35 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.95 }),
  metal: new THREE.MeshStandardMaterial({ color: '#dfe7ef', roughness: 0.35, metalness: 0.6 }),
  base: new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.95 }),
}

function StationHouse({ station, index, total, selected, level, onSelect }: {
  station: Station; index: number; total: number; selected: boolean; level?: number | null; onSelect: () => void
}) {
  const { x, z } = stationSpot(index, total)
  // Casa na margem de terreno mais baixo (e seco) do lado do rio; um pier liga a casa à água.
  const side = heightAt(x + 13, z) <= heightAt(x - 13, z) ? 1 : -1
  const hx = x + side * 13
  const hy = Math.max(0.5, heightAt(hx, z))
  const pin = useRef<THREE.Group>(null)
  const light = useRef<THREE.Mesh>(null)
  const color = selected ? '#ffd24a' : '#38bdf8'
  useFrame(({ clock }) => {
    if (pin.current) pin.current.position.y = 9.5 + Math.sin(clock.elapsedTime * 1.6 + index) * 0.3
    if (light.current) (light.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.6 * Math.abs(Math.sin(clock.elapsedTime * 2 + index))
  })
  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      {/* pier de madeira até o rio */}
      <mesh position={[x + side * 6.2, 0.35, z]} material={M.wood}><boxGeometry args={[Math.abs(hx - x) - 4.5, 0.25, 1.3]} /></mesh>
      {/* régua limnimétrica dentro d'água */}
      <mesh position={[x + side * 1.8, 1.9, z + 1.4]} material={M.metal}><boxGeometry args={[0.22, 4.4, 0.22]} /></mesh>
      {[0.6, 1.4, 2.2, 3.0].map((yy) => <mesh key={yy} position={[x + side * 1.8, yy, z + 1.52]} material={M.roof}><boxGeometry args={[0.34, 0.1, 0.06]} /></mesh>)}

      <group position={[hx, hy, z]}>
        <mesh position={[0, -0.2, 0]} material={M.base}><boxGeometry args={[4.4, 1, 4]} /></mesh>
        <mesh position={[0, 1.7, 0]} material={M.wall}><boxGeometry args={[3.6, 2.6, 3.2]} /></mesh>
        <mesh position={[0, 3.7, 0]} rotation={[0, Math.PI / 4, 0]} material={M.roof}><coneGeometry args={[3.5, 1.9, 4]} /></mesh>
        <mesh position={[-side * 0.6, 1.2, 1.62]} material={M.door}><boxGeometry args={[0.9, 1.7, 0.1]} /></mesh>
        <mesh position={[side * 0.9, 1.9, 1.62]} material={M.glass}><boxGeometry args={[0.9, 0.8, 0.08]} /></mesh>
        {/* torre com antena e luz de sinalização */}
        <mesh position={[side * 2.9, 3.2, -0.6]} material={M.metal}><cylinderGeometry args={[0.1, 0.16, 6.4, 6]} /></mesh>
        <mesh position={[side * 2.9, 6.5, -0.6]} material={M.metal}><sphereGeometry args={[0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <mesh ref={light} position={[side * 2.9, 6.9, -0.6]}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#ff4d4d" emissive="#ff2a2a" emissiveIntensity={1} /></mesh>
        {/* painel solar */}
        <mesh position={[0, 4.55, 0.4]} rotation={[-0.5, 0, 0]}><boxGeometry args={[1.5, 0.06, 1]} /><meshStandardMaterial color="#17315f" metalness={0.5} roughness={0.25} /></mesh>

        {/* marcador flutuante + linha até a casa */}
        <mesh position={[0, 6.2, 0]}><cylinderGeometry args={[0.05, 0.05, 6.4, 6]} /><meshBasicMaterial color={color} transparent opacity={0.5} /></mesh>
        <group ref={pin} position={[0, 9.5, 0]} scale={selected ? 1.3 : 1}>
          <mesh><octahedronGeometry args={[0.85, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.4 : 0.8} roughness={0.25} /></mesh>
          <Label3D position={[0, 2.6, 0]} variant={selected ? 'gold' : 'dark'} size={0.048}
            lines={[station.name, level != null ? `${num(level)} m` : 'sem leituras']} />
        </group>
      </group>
      {selected && <mesh position={[hx, hy + 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.6, 4.2, 40]} /><meshBasicMaterial color="#ffd24a" transparent opacity={0.8} /></mesh>}
    </group>
  )
}

/* ---------- Câmera ---------- */
function Controls({ spin }: { spin: boolean }) {
  const [auto, setAuto] = useState(spin && !prefersReducedMotion())
  return (
    <OrbitControls
      makeDefault enablePan={false} autoRotate={auto} autoRotateSpeed={0.35} enableDamping={false}
      minDistance={28} maxDistance={150} minPolarAngle={0.35} maxPolarAngle={1.42} target={[4, 2, 6]}
      onStart={() => setAuto(false)}
    />
  )
}

export interface ValleyProps {
  stations: Station[]
  selectedId?: string
  onSelect: (id: string) => void
  levels: Record<string, number | null | undefined>
  rain: number
  height?: number
}

function ValleyScene({ stations, selectedId, onSelect, levels, rain, height = 460 }: ValleyProps) {
  const quality = useQuality()
  const hi = quality === 'high'
  const P = PRESET[hi ? 'high' : 'low']
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  // Monta a cena só quando entra na tela; ao sair, ela apenas pausa (sem timer, sem GPU).
  useEffect(() => {
    if (!wrap.current) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px', threshold: 0 })
    io.observe(wrap.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || ready) return
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void }
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setReady(true), { timeout: 500 }) : window.setTimeout(() => setReady(true), 60)
    return () => { if (w.requestIdleCallback) w.cancelIdleCallback?.(id); else clearTimeout(id) }
  }, [visible, ready])

  const selLevel = selectedId ? levels[selectedId] : null
  const lv = typeof selLevel === 'number' ? selLevel : 1.1

  return (
    <div ref={wrap} className="canvas-wrap" style={{ height }}>
      {ready ? (
        <Canvas
          key={quality}
          frameloop="demand"
          dpr={P.dpr}
          camera={{ position: [86, 40, 58], fov: 42, near: 0.5, far: 1400 }}
          gl={{ antialias: P.aa, powerPreference: hi ? 'high-performance' : 'low-power', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.72 }}
        >
          <Ticker fps={P.fps} active={visible} />
          <PerfGuard enabled={hi} />
          <color attach="background" args={['#cfe3f2']} />
          <fog attach="fog" args={['#d3e6f3', 130, 420]} />
          <Sky distance={4500} sunPosition={SUN.clone().multiplyScalar(1000)} turbidity={2.2} rayleigh={1.6} mieCoefficient={0.004} mieDirectionalG={0.82} />
          <hemisphereLight args={['#d6eaff', '#6c8a52', 1.6]} />
          <directionalLight position={SUN.clone().multiplyScalar(120).toArray()} intensity={2.3} color="#fff0d2" />
          <Terrain seg={P.seg} />
          <Trees count={P.trees} />
          <Village count={P.village} />
          {P.mirror > 0 ? <River level={lv} mirror={P.mirror} /> : <RiverSimple level={lv} />}
          <Rain intensity={rain} N={P.rain} animate={hi} />
          {stations.map((s, i) => (
            <StationHouse key={s.id} station={s} index={i} total={stations.length} selected={s.id === selectedId} level={levels[s.id]} onSelect={() => onSelect(s.id)} />
          ))}
          <Controls spin={P.spin} />
        </Canvas>
      ) : <div className="fallback3d dark"><div className="spinner" /><span>Preparando o vale…</span></div>}
    </div>
  )
}

export default memo(ValleyScene)
