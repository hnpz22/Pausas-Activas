import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EXERCISES } from './exercises'

interface BreakStartData {
  breakSeconds: number
  workMinutes: number
  snoozeMinutes: number
  mode: 'health' | 'pomodoro'
  isLongBreak: boolean
  cycle: number
  cyclesBeforeLongBreak: number
}

declare global {
  interface Window {
    breakAPI: {
      onBreakStart: (cb: (data: BreakStartData) => void) => void
      complete: () => void
      skip: () => void
      snooze: () => void
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const slideVariants = {
  enter: (d: number) => ({ x: d * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -48, opacity: 0 })
}

export default function App(): JSX.Element {
  const [breakSeconds, setBreakSeconds] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [workMinutes, setWorkMinutes] = useState(25)
  const [snoozeMinutes, setSnoozeMinutes] = useState(3)
  const [mode, setMode] = useState<'health' | 'pomodoro'>('health')
  const [isLongBreak, setIsLongBreak] = useState(false)
  const [cycle, setCycle] = useState(0)
  const [cyclesBeforeLongBreak, setCyclesBeforeLongBreak] = useState(4)
  const [visible, setVisible] = useState(false)

  // Ejercicio actual
  const [exerciseIdx, setExerciseIdx] = useState(0)
  const [direction, setDirection] = useState(1)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const exercise = EXERCISES[exerciseIdx]

  // Escuchar el inicio de la pausa desde main
  useEffect(() => {
    window.breakAPI.onBreakStart((data) => {
      setBreakSeconds(data.breakSeconds)
      setRemaining(data.breakSeconds)
      setWorkMinutes(data.workMinutes)
      setSnoozeMinutes(data.snoozeMinutes)
      setMode(data.mode)
      setIsLongBreak(data.isLongBreak)
      setCycle(data.cycle)
      setCyclesBeforeLongBreak(data.cyclesBeforeLongBreak)
      setExerciseIdx(Math.floor(Math.random() * EXERCISES.length))
      setVisible(true)
    })
  }, [])

  // Countdown
  useEffect(() => {
    if (!visible || remaining <= 0) return
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          window.breakAPI.complete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [visible])

  // Auto-avanzar ejercicio cada 45 segundos
  useEffect(() => {
    if (!visible) return
    autoAdvRef.current = setInterval(() => {
      setDirection(1)
      setExerciseIdx((i) => (i + 1) % EXERCISES.length)
    }, 45_000)
    return () => clearInterval(autoAdvRef.current!)
  }, [visible])

  function goNext(): void {
    setDirection(1)
    setExerciseIdx((i) => (i + 1) % EXERCISES.length)
  }

  function goPrev(): void {
    setDirection(-1)
    setExerciseIdx((i) => (i - 1 + EXERCISES.length) % EXERCISES.length)
  }

  const progress = breakSeconds > 0 ? 1 - remaining / breakSeconds : 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="blur-bg" />

          <div className="content">
            {/* Cabecera */}
            <motion.div
              className="header"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="title">{isLongBreak ? 'Descanso largo' : 'Pausa Activa'}</h1>
              <p className="subtitle">
                {mode === 'pomodoro'
                  ? isLongBreak
                    ? `Completaste ${cyclesBeforeLongBreak} pomodoros — date un respiro más largo`
                    : `Pomodoro ${cycle}/${cyclesBeforeLongBreak} — ${workMinutes} min de foco`
                  : `${workMinutes} minutos de trabajo — tu cuerpo necesita esto`}
              </p>
            </motion.div>

            {/* Ilustración + info del ejercicio */}
            <div className="exercise-wrapper">
              {/* Flecha izquierda */}
              <button className="nav-btn" onClick={goPrev} aria-label="Ejercicio anterior">
                ‹
              </button>

              <div className="exercise-center">
                {/* Ilustración animada con transición slide */}
                <div className="illustration-area">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={exercise.id}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.28, ease: 'easeOut' }}
                      className="illustration-frame"
                    >
                      <exercise.Illustration />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Nombre y descripción */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={exercise.id + '-text'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="exercise-info"
                  >
                    <span className="exercise-name">{exercise.name}</span>
                    <p className="exercise-desc">{exercise.description}</p>
                    <span className="exercise-hint">{exercise.hint}</span>
                  </motion.div>
                </AnimatePresence>

                {/* Dots de progreso */}
                <div className="dots">
                  {EXERCISES.map((_, i) => (
                    <button
                      key={i}
                      className={`dot ${i === exerciseIdx ? 'dot--active' : ''}`}
                      onClick={() => {
                        setDirection(i > exerciseIdx ? 1 : -1)
                        setExerciseIdx(i)
                      }}
                      aria-label={`Ejercicio ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Flecha derecha */}
              <button className="nav-btn" onClick={goNext} aria-label="Siguiente ejercicio">
                ›
              </button>
            </div>

            {/* Countdown + barra de progreso */}
            <motion.div
              className="timer-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <span className="countdown">{formatTime(remaining)}</span>
              <div className="progress-bar">
                <motion.div
                  className="progress-fill"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>

            {/* Botones */}
            <motion.div
              className="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <button className="btn btn-snooze" onClick={() => window.breakAPI.snooze()}>
                Posponer {snoozeMinutes} min
              </button>
              <button className="btn btn-skip" onClick={() => window.breakAPI.skip()}>
                Saltar pausa
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
