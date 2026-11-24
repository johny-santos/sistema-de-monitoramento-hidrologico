import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export default function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.4, ease: 'easeOut' as const },
})
