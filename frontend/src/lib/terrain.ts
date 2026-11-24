// Terreno procedural do "Vale 3D": ruído fractal + canal de rio sinuoso. Determinístico (sem Math.random).

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Centro do rio (eixo X) para cada posição Z. */
export const riverX = (z: number) => 16 * Math.sin(z * 0.032) + 5 * Math.sin(z * 0.085 + 1.3)

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm(x: number, y: number, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq)
    freq *= 2
    amp *= 0.5
  }
  return sum
}

/** Altura do terreno em (x, z). A água fica em y = 0. */
export function heightAt(x: number, z: number) {
  const d = Math.abs(x - riverX(z))
  const valley = smooth(4, 70, d)
  const big = fbm(x * 0.011 + 10, z * 0.011 + 3)
  const detail = fbm(x * 0.07, z * 0.07, 4)
  const bank = smooth(1, 10, d) * 2.3
  return -2.3 + bank + valley * (7 + big * 27) + detail * valley * 2.6
}

/** PRNG determinístico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const TERRAIN_SIZE = 260

/** Posição de cada estação ao longo do rio (distribuída entre z = -70 e +70). */
export function stationSpot(i: number, n: number) {
  const z = n <= 1 ? 0 : -70 + (140 * i) / (n - 1)
  return { x: riverX(z), z }
}
