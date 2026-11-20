import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/hud.css'
import './styles/panels.css'
import './styles/passport.css'
import './styles/resume.css'
import './styles/print.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
