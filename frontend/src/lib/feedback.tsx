import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import Modal from '../components/Modal'

/* ---------- Avisos rápidos (toast) ---------- */
type ToastKind = 'ok' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; text: string }

/* ---------- Confirmação (no lugar do window.confirm) ---------- */
interface ConfirmOpts { title: string; message: string; confirmLabel?: string; danger?: boolean }

interface Feedback {
  toast: (text: string, kind?: ToastKind) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<Feedback | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [ask, setAsk] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const seq = useRef(0)

  const toast = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-3), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setAsk({ ...opts, resolve })), [])
  const answer = (v: boolean) => { ask?.resolve(v); setAsk(null) }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])
  const Icon = { ok: CheckCircle2, error: AlertTriangle, info: Info }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const I = Icon[t.kind]
            return (
              <motion.div key={t.id} className={`toast ${t.kind}`} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.2 }}>
                <I size={18} /><span>{t.text}</span>
                <button onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} aria-label="Fechar aviso"><X size={14} /></button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <Modal open={!!ask} onClose={() => answer(false)} title={ask?.title ?? ''} icon={<AlertTriangle size={20} />}>
        <p className="confirm-msg">{ask?.message}</p>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={() => answer(false)}>Cancelar</button>
          <button className={ask?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => answer(true)}>{ask?.confirmLabel ?? 'Confirmar'}</button>
        </div>
      </Modal>
    </Ctx.Provider>
  )
}

export function useFeedback() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFeedback fora do FeedbackProvider')
  return v
}
