import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export const Loading = ({ label = 'Carregando dados…' }: { label?: string }) => (
  <div className="state"><div className="spinner" />{label}</div>
)

export function ErrorBox({ error }: { error: unknown }) {
  const qc = useQueryClient()
  return (
    <div className="state error" role="alert">
      <AlertTriangle size={28} />
      <strong>Não foi possível carregar os dados.</strong>
      <span>{error instanceof Error ? error.message : 'Erro desconhecido'}</span>
      <small>Confira se o backend está rodando: <code>python manage.py runserver</code></small>
      <button className="btn-ghost" onClick={() => qc.invalidateQueries()}><RotateCcw size={16} /> Tentar novamente</button>
    </div>
  )
}
