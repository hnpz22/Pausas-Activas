import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Stats from './Stats'
import './app.css'

// Una sola build del renderer sirve dos vistas: el overlay de pausa (default)
// y la ventana de estadísticas (#stats). El main abre cada ventana con su hash.
const isStats = window.location.hash.replace('#', '') === 'stats'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isStats ? <Stats /> : <App />}</React.StrictMode>
)
