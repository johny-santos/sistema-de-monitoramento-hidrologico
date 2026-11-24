import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { FeedbackProvider } from './lib/feedback'
import App from './App'
import './lib/chartSetup'
import './index.css'
import './features.css'
import './airy.css'
import './polish.css'

const queryClient = new QueryClient({
  // Dados se atualizam sozinhos a cada 60 s, só com a aba visível ("tempo real" sem gastar bateria em segundo plano).
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, refetchInterval: 60_000, refetchIntervalInBackground: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeedbackProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </FeedbackProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
