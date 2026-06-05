import { motion } from 'framer-motion'

export interface Exercise {
  id: string
  name: string
  description: string
  hint: string
  Illustration: () => JSX.Element
}

// ─── Cuello ───────────────────────────────────────────────────────────────────
// Cabeza que se inclina de lado a lado girando desde la base del cuello
function NeckTilt(): JSX.Element {
  return (
    <svg viewBox="0 0 80 108" width="80" height="108" fill="none">
      <line x1="10" y1="76" x2="70" y2="76"
        stroke="#63b3ed" strokeWidth="3" strokeLinecap="round" opacity="0.3"/>
      <motion.g
        style={{ transformOrigin: '40px 76px' }}
        animate={{ rotate: [-22, 0, 22, 0, -22] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="40" y1="52" x2="40" y2="76"
          stroke="#63b3ed" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="40" cy="34" r="18" stroke="#63b3ed" strokeWidth="2.5"/>
      </motion.g>
    </svg>
  )
}

// ─── Ojos ─────────────────────────────────────────────────────────────────────
// Ojo que parpadea lentamente (regla 20-20-20)
function EyeRest(): JSX.Element {
  return (
    <svg viewBox="0 0 120 76" width="120" height="76" fill="none">
      <text x="60" y="13" textAnchor="middle"
        fill="#63b3ed" fontSize="9" opacity="0.45"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">
        20 min · 20 pies · 20 seg
      </text>
      <path d="M 16 44 Q 60 20 104 44" stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round"/>
      <motion.ellipse
        cx="60" cy="44" rx="44" ry="20"
        stroke="#63b3ed" strokeWidth="2.5"
        style={{ transformOrigin: '60px 44px' }}
        animate={{ scaleY: [1, 0.06, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.45, 1] }}
      />
      <motion.circle
        cx="60" cy="44" r="10"
        fill="#63b3ed"
        style={{ transformOrigin: '60px 44px' }}
        animate={{ scale: [1, 0.1, 1], opacity: [0.38, 0, 0.38] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.45, 1] }}
      />
    </svg>
  )
}

// ─── Hombros ──────────────────────────────────────────────────────────────────
// Dos puntos rotando en círculos (rotación de hombros hacia atrás)
function ShoulderRoll(): JSX.Element {
  return (
    <svg viewBox="0 0 120 96" width="120" height="96" fill="none">
      <line x1="32" y1="48" x2="88" y2="48"
        stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" opacity="0.25"/>
      <circle cx="32" cy="48" r="14" stroke="#63b3ed" strokeWidth="1"
        strokeDasharray="3 3" opacity="0.2"/>
      <circle cx="88" cy="48" r="14" stroke="#63b3ed" strokeWidth="1"
        strokeDasharray="3 3" opacity="0.2"/>
      <motion.g
        style={{ transformOrigin: '32px 48px' }}
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="32" cy="34" r="7" fill="#63b3ed" opacity="0.9"/>
      </motion.g>
      <motion.g
        style={{ transformOrigin: '88px 48px' }}
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="88" cy="34" r="7" fill="#63b3ed" opacity="0.9"/>
      </motion.g>
    </svg>
  )
}

// ─── Muñecas ──────────────────────────────────────────────────────────────────
// Mano haciendo círculos — el punto recorre la trayectoria
function WristCircles(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" width="100" height="100" fill="none">
      <circle cx="50" cy="50" r="28" stroke="#63b3ed" strokeWidth="1.5"
        strokeDasharray="4 3" opacity="0.18"/>
      <motion.g
        style={{ transformOrigin: '50px 50px' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="50" cy="22" r="8" stroke="#63b3ed" strokeWidth="2.5"/>
        <line x1="46" y1="16" x2="44" y2="11"
          stroke="#63b3ed" strokeWidth="2" strokeLinecap="round"/>
        <line x1="50" y1="15" x2="50" y2="9"
          stroke="#63b3ed" strokeWidth="2" strokeLinecap="round"/>
        <line x1="54" y1="16" x2="56" y2="11"
          stroke="#63b3ed" strokeWidth="2" strokeLinecap="round"/>
      </motion.g>
    </svg>
  )
}

// ─── Levantarse ───────────────────────────────────────────────────────────────
// Figura con flecha hacia arriba — recordatorio de pararse
function StandUp(): JSX.Element {
  return (
    <svg viewBox="0 0 90 100" width="90" height="100" fill="none">
      <circle cx="38" cy="18" r="12" stroke="#63b3ed" strokeWidth="2.5"/>
      <line x1="38" y1="30" x2="38" y2="70"
        stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="38" y1="44" x2="20" y2="58"
        stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="38" y1="44" x2="56" y2="58"
        stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="38" y1="70" x2="26" y2="92"
        stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="38" y1="70" x2="50" y2="92"
        stroke="#63b3ed" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <motion.g
        animate={{ y: [-5, 4, -5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="72" y1="55" x2="72" y2="76"
          stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" opacity="0.75"/>
        <polyline points="66,61 72,50 78,61"
          stroke="#63b3ed" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" fill="none" opacity="0.75"/>
      </motion.g>
    </svg>
  )
}

// ─── Respiración ──────────────────────────────────────────────────────────────
// Círculos concéntricos que se expanden y contraen
function DeepBreath(): JSX.Element {
  const ring = (delay: number, maxR: number, minR: number) => (
    <motion.circle cx="50" cy="50" fill="none" stroke="#63b3ed"
      animate={{ r: [minR, maxR, minR], opacity: [0.2, 0.55, 0.2] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
  return (
    <svg viewBox="0 0 100 100" width="100" height="100" fill="none">
      {ring(0.6, 44, 28)}
      {ring(0.3, 33, 20)}
      {ring(0, 22, 13)}
      <motion.text x="50" y="88" textAnchor="middle"
        fill="#63b3ed" fontSize="8.5" opacity="0.5"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        animate={{ opacity: [0.25, 0.65, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        inhala · exhala
      </motion.text>
    </svg>
  )
}

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export const EXERCISES: Exercise[] = [
  {
    id: 'neck',
    name: 'Cuello',
    description: 'Inclina la cabeza lentamente hacia cada hombro. Siente el estiramiento lateral.',
    hint: '3 repeticiones · 30 seg',
    Illustration: NeckTilt
  },
  {
    id: 'eyes',
    name: 'Ojos',
    description: 'Mira algo a 6 metros de distancia durante 20 segundos. Relaja los músculos oculares.',
    hint: 'Regla 20-20-20 · 20 seg',
    Illustration: EyeRest
  },
  {
    id: 'shoulders',
    name: 'Hombros',
    description: 'Rota los hombros hacia atrás en círculos amplios y lentos. Libera la tensión acumulada.',
    hint: '10 rotaciones · 30 seg',
    Illustration: ShoulderRoll
  },
  {
    id: 'wrists',
    name: 'Muñecas',
    description: 'Haz círculos lentos con las muñecas, primero en un sentido y luego en el otro.',
    hint: '5 en cada sentido · 30 seg',
    Illustration: WristCircles
  },
  {
    id: 'standup',
    name: 'Levántate',
    description: 'Párate, camina unos pasos, estira los brazos hacia arriba. Tu postura lo agradece.',
    hint: 'Caminar · 1 min',
    Illustration: StandUp
  },
  {
    id: 'breathe',
    name: 'Respiración',
    description: 'Inhala profundo por 4 segundos, sostén 2, exhala por 6. Repite varias veces.',
    hint: '4-2-6 · 1 min',
    Illustration: DeepBreath
  }
]
