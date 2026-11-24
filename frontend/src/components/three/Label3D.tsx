import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export type LabelVariant = 'dark' | 'gold' | 'tick' | 'tip'

const STYLE: Record<LabelVariant, { bg: string | null; fg: string; sub: string; border: string | null }> = {
  dark: { bg: 'rgba(6,26,63,0.9)', fg: '#ffffff', sub: '#9fd0ff', border: 'rgba(255,255,255,0.22)' },
  gold: { bg: 'rgba(255,200,48,0.97)', fg: '#3a2a00', sub: '#6b4b00', border: 'rgba(255,255,255,0.6)' },
  tip: { bg: 'rgba(6,26,63,0.95)', fg: '#ffffff', sub: '#8fcbff', border: 'rgba(143,208,255,0.45)' },
  tick: { bg: null, fg: '#bcd9f7', sub: '#bcd9f7', border: null },
}
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif'

function draw(lines: string[], variant: LabelVariant) {
  const st = STYLE[variant]
  const px = 2                                   // nitidez (retina) sem custo de DOM
  const size = [30, 24]                          // título / subtítulo
  const pad = st.bg ? 18 : 6
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const fonts = lines.map((_, i) => `${i === 0 ? 700 : 600} ${size[Math.min(i, 1)]}px ${FONT}`)
  const widths = lines.map((l, i) => { ctx.font = fonts[i]; return ctx.measureText(l).width })
  const w = Math.ceil(Math.max(...widths) + pad * 2)
  const lh = lines.map((_, i) => size[Math.min(i, 1)] * 1.25)
  const h = Math.ceil(lh.reduce((a, b) => a + b, 0) + pad * 1.2)
  c.width = w * px; c.height = h * px
  ctx.scale(px, px)
  if (st.bg) {
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 14)
    ctx.fillStyle = st.bg; ctx.fill()
    if (st.border) { ctx.strokeStyle = st.border; ctx.lineWidth = 2; ctx.stroke() }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  let y = pad * 0.6
  lines.forEach((l, i) => {
    ctx.font = fonts[i]; ctx.fillStyle = i === 0 ? st.fg : st.sub
    ctx.fillText(l, w / 2, y); y += lh[i]
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, aspect: w / h }
}

/** Rótulo desenhado em textura (sprite): tamanho constante na tela, sem DOM, não intercepta cliques. */
export default function Label3D({ lines, position, variant = 'dark', size = 0.05 }: {
  lines: string[]; position: [number, number, number]; variant?: LabelVariant; size?: number
}) {
  const key = lines.join('\n') + '|' + variant
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { tex, aspect } = useMemo(() => draw(lines, variant), [key])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <sprite position={position} scale={[aspect * size, size, 1]} renderOrder={20} raycast={() => null}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent toneMapped={false} />
    </sprite>
  )
}
