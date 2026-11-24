import { KeyRound, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useFeedback } from '../lib/feedback'
import { Input } from './Field'
import Modal from './Modal'

export default function LoginModal() {
  const { loginOpen, closeLogin, login } = useAuth()
  const { toast } = useFeedback()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(user.trim(), pass)
      setPass('')
      toast(`Bem-vindo(a), ${user.trim()}.`)
    } catch (err) {
      setError((err as { status?: number }).status === 400 ? 'Usuário ou senha incorretos.' : (err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <Modal open={loginOpen} onClose={closeLogin} title="Entrar como administrador" icon={<KeyRound size={20} />}>
      <form onSubmit={submit} className="form">
        <p className="form-note">Use o usuário criado com <code>createsuperuser</code>. A leitura dos dados é pública; cadastrar e excluir exige login.</p>
        <Input label="Usuário" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required autoFocus />
        <Input label="Senha" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
        {error && <div className="form-error">{error}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Entrando…' : <>Entrar <LogIn size={16} /></>}</button>
      </form>
    </Modal>
  )
}
