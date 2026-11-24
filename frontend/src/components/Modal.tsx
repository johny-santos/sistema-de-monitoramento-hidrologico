import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, icon, children }: {
  open: boolean; onClose: () => void; title: string; icon?: ReactNode; children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)

  // Acessibilidade do teclado: foco entra no diálogo, Tab fica preso nele, Esc fecha e o foco volta ao botão de origem.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      const els = box.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = [...(els ?? [])].find((e) => !e.classList.contains('x')) ?? box.current
      first?.focus()
    }, 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !box.current) return
      const els = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!els.length) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={onClose}>
          <motion.div
            ref={box} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              {icon && <div className="modal-icon">{icon}</div>}
              <h3>{title}</h3>
              <button className="x" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
            </header>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
