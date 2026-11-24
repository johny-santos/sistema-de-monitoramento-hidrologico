let cached: boolean | null = null

/** true se o navegador consegue criar um contexto WebGL (resultado em cache). */
export function webglSupported() {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    cached = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    cached = false
  }
  return cached
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
