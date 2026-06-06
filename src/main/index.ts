import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  powerMonitor,
  screen,
  shell
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { setupAutoUpdater, LANDING_URL } from './updater'
import { recordCompleted, recordSkipped, recordSnoozed, summary, todayStat, currentStreak } from './stats'
import { isInMeeting } from './meeting'
import trayIcon from '../../resources/tray.png?asset'

// ─── Settings ────────────────────────────────────────────────────────────────

type Mode = 'health' | 'pomodoro'

interface Settings {
  workMinutes: number // en Pomodoro = duración del bloque de foco
  breakMinutes: number
  snoozeMinutes: number
  mode: Mode
  longBreakMinutes: number // descanso largo (solo Pomodoro)
  cyclesBeforeLongBreak: number // cada cuántos pomodoros toca el descanso largo
  eyeReminder: boolean // recordatorio 20-20-20
  hydrationReminder: boolean // recordatorio de hidratación
  autoDndInMeetings: boolean // posponer la pausa si detecta una reunión/videollamada
}

const DEFAULTS: Settings = {
  workMinutes: 25,
  breakMinutes: 5,
  snoozeMinutes: 3,
  mode: 'health',
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  eyeReminder: true,
  hydrationReminder: false,
  autoDndInMeetings: true
}

const DEV_WORK_MINUTES = 1
const DEV_BREAK_MINUTES = 0.5

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): Settings {
  try {
    if (existsSync(settingsPath())) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsPath(), 'utf8')) }
    }
  } catch { /* usa defaults */ }
  return { ...DEFAULTS }
}

function saveSettings(s: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
}

// ─── Estado global ──────────────────────────────────────────────────────────

let tray: Tray | null = null
let breakWindow: BrowserWindow | null = null
let statsWindow: BrowserWindow | null = null
let settings = loadSettings()
let availableUpdate: string | null = null // versión nueva detectada (sin firma → solo avisamos)

if (is.dev) {
  settings.workMinutes = DEV_WORK_MINUTES
  settings.breakMinutes = DEV_BREAK_MINUTES
}

let activeSeconds = 0
let onBreak = false
let snoozedUntil = 0
let dndUntil = 0 // "No molestar": pausa todo hasta este timestamp (manual)
let meetingUntil = 0 // pausa pospuesta automáticamente por reunión detectada (re-chequea al expirar)
let checkingMeeting = false // evita consultas solapadas a la ventana en foco
let pomodoroCount = 0 // bloques de foco completados (para la cadencia del descanso largo)
let isLongBreakNow = false

// Acumuladores independientes de las micro-pausas (se cuentan mientras hay actividad)
let eyeSeconds = 0
let hydrationSeconds = 0

// Segundos restantes que disparan una notificación de aviso
const WARN_THRESHOLDS_S = is.dev ? [30, 10] : [5 * 60, 2 * 60, 60]
const sentWarnings = new Set<number>()

const CHECK_INTERVAL_MS = is.dev ? 5_000 : 30_000
const IDLE_THRESHOLD_S = 5 * 60

const EYE_INTERVAL_S = is.dev ? 40 : 20 * 60 // regla 20-20-20
const HYDRATION_INTERVAL_S = is.dev ? 80 : 60 * 60

// Si detectamos reunión al ir a saltar la pausa, posponemos este lapso y re-chequeamos
const MEETING_RECHECK_MS = is.dev ? 15_000 : 3 * 60 * 1000

// ─── No molestar (manual) ─────────────────────────────────────────────────────

function dndActive(): boolean {
  return dndUntil > Date.now()
}

function setDnd(value: number | 'forever' | 'off'): void {
  if (value === 'off') dndUntil = 0
  else if (value === 'forever') dndUntil = Number.MAX_SAFE_INTEGER
  else dndUntil = Date.now() + value * 60_000
  resetWarnings()
  updateTray()
  tray?.setContextMenu(buildTrayMenu())
}

// ─── Micro-pausas ──────────────────────────────────────────────────────────────

function fireEyeReminder(): void {
  if (Notification.isSupported()) {
    new Notification({
      title: '👀 Descanso visual (20-20-20)',
      body: 'Mira algo a ~6 metros de distancia durante 20 segundos.',
      silent: true
    }).show()
  }
}

function fireHydrationReminder(): void {
  if (Notification.isSupported()) {
    new Notification({
      title: '💧 Toma agua',
      body: 'Una pausa corta para hidratarte.',
      silent: true
    }).show()
  }
}

// ─── Notificaciones de aviso (antes de la pausa) ───────────────────────────────

function checkWarnings(): void {
  const remaining = settings.workMinutes * 60 - activeSeconds

  for (const threshold of WARN_THRESHOLDS_S) {
    if (remaining <= threshold && !sentWarnings.has(threshold)) {
      sentWarnings.add(threshold)

      const mins = Math.round(remaining / 60)
      const label = mins >= 1 ? `${mins} minuto${mins > 1 ? 's' : ''}` : 'menos de 1 minuto'

      if (Notification.isSupported()) {
        new Notification({
          title: 'Pausas Activas',
          body: `Pausa en ${label}. Ve terminando lo que estás haciendo.`,
          silent: true
        }).show()
      }

      updateTray()
    }
  }
}

function resetWarnings(): void {
  sentWarnings.clear()
}

// ─── Ventana de pausa ─────────────────────────────────────────────────────────

function createBreakWindow(): void {
  if (breakWindow) return

  const { width, height } = screen.getPrimaryDisplay().bounds

  breakWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  breakWindow.setAlwaysOnTop(true, 'screen-saver')
  breakWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    breakWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    breakWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  breakWindow.on('closed', () => { breakWindow = null })

  breakWindow.webContents.once('did-finish-load', () => {
    const breakSeconds = (isLongBreakNow ? settings.longBreakMinutes : settings.breakMinutes) * 60
    breakWindow?.webContents.send('break:start', {
      breakSeconds,
      workMinutes: settings.workMinutes,
      snoozeMinutes: settings.snoozeMinutes,
      mode: settings.mode,
      isLongBreak: isLongBreakNow,
      // posición dentro del set de pomodoros (1..cyclesBeforeLongBreak)
      cycle: settings.mode === 'pomodoro'
        ? ((pomodoroCount - 1) % settings.cyclesBeforeLongBreak) + 1
        : 0,
      cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak
    })
  })
}

function closeBreakWindow(): void {
  breakWindow?.close()
  breakWindow = null
}

// ─── Ventana de estadísticas ────────────────────────────────────────────────

function openStatsWindow(): void {
  if (statsWindow) {
    statsWindow.focus()
    return
  }
  if (process.platform === 'darwin') app.dock.show() // visible/enfocable desde una app de tray

  statsWindow = new BrowserWindow({
    width: 480,
    height: 480,
    resizable: false,
    title: 'Estadísticas — Pausas Activas',
    backgroundColor: '#0b0e16',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  statsWindow.on('closed', () => {
    statsWindow = null
    if (process.platform === 'darwin') app.dock.hide()
  })

  // Reusa el mismo bundle del renderer; el hash `#stats` le dice qué vista montar.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    statsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#stats`)
  } else {
    statsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'stats' })
  }
}

// ─── Lógica de timer ─────────────────────────────────────────────────────────

function triggerBreak(): void {
  onBreak = true
  activeSeconds = 0
  resetWarnings()

  if (settings.mode === 'pomodoro') {
    pomodoroCount++
    isLongBreakNow = pomodoroCount % settings.cyclesBeforeLongBreak === 0
  } else {
    isLongBreakNow = false
  }

  updateTray()
  createBreakWindow()
}

function endBreak(): void {
  onBreak = false
  activeSeconds = 0
  resetWarnings()
  closeBreakWindow()
  updateTray()
}

function snoozeBreak(minutes: number): void {
  onBreak = false
  snoozedUntil = Date.now() + minutes * 60 * 1000
  resetWarnings()
  closeBreakWindow()
  updateTray()
}

function setMode(mode: Mode): void {
  settings.mode = mode
  saveSettings(settings)
  activeSeconds = 0
  pomodoroCount = 0
  resetWarnings()
  updateTray()
  tray?.setContextMenu(buildTrayMenu())
}

// Justo antes de interrumpir: si está activado y detectamos una reunión, posponemos
// la pausa unos minutos y la re-chequeamos al expirar (en vez de tapar la videollamada).
async function maybeTriggerBreak(): Promise<void> {
  if (settings.autoDndInMeetings && !checkingMeeting) {
    checkingMeeting = true
    let inMeeting = false
    try {
      inMeeting = await isInMeeting()
    } catch {
      inMeeting = false // falla seguro: si no podemos saber, dejamos pasar la pausa
    }
    checkingMeeting = false

    if (inMeeting) {
      meetingUntil = Date.now() + MEETING_RECHECK_MS
      updateTray()
      return
    }
  }
  triggerBreak()
}

function startActivityTimer(): void {
  setInterval(() => {
    if (onBreak) return
    if (dndActive()) { updateTray(); return } // No molestar manual: pausa todo
    if (meetingUntil > Date.now()) { updateTray(); return } // pospuesto por reunión
    if (snoozedUntil > Date.now()) return

    const idleSecs = powerMonitor.getSystemIdleTime()

    if (idleSecs > IDLE_THRESHOLD_S) {
      // Salud: descontar el tiempo ausente (la pausa cuenta tiempo activo real).
      // Pomodoro: solo pausar, sin perder el progreso del bloque de foco.
      if (settings.mode === 'health' && activeSeconds > 0) {
        activeSeconds = 0
        resetWarnings()
        updateTray()
      }
      return
    }

    const step = CHECK_INTERVAL_MS / 1000
    activeSeconds += step

    // Micro-pausas (en ambos modos, mientras haya actividad)
    if (settings.eyeReminder) {
      eyeSeconds += step
      if (eyeSeconds >= EYE_INTERVAL_S) {
        eyeSeconds = 0
        fireEyeReminder()
      }
    }
    if (settings.hydrationReminder) {
      hydrationSeconds += step
      if (hydrationSeconds >= HYDRATION_INTERVAL_S) {
        hydrationSeconds = 0
        fireHydrationReminder()
      }
    }

    checkWarnings()
    updateTray()

    if (activeSeconds >= settings.workMinutes * 60) {
      void maybeTriggerBreak()
    }
  }, CHECK_INTERVAL_MS)
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function updateTray(): void {
  if (!tray) return

  let label: string
  if (dndActive()) {
    label = '🌙'
  } else if (meetingUntil > Date.now()) {
    label = '🎥'
  } else if (onBreak) {
    label = isLongBreakNow ? 'Descanso' : 'Pausa'
  } else if (snoozedUntil > Date.now()) {
    const left = Math.ceil((snoozedUntil - Date.now()) / 60000)
    label = `~${left}m`
  } else {
    const remaining = settings.workMinutes * 60 - activeSeconds
    const minutesLeft = Math.max(0, Math.ceil(remaining / 60))
    const warningZone = is.dev ? remaining <= 30 : remaining <= 5 * 60
    label = warningZone ? `!! ${minutesLeft}m` : `${minutesLeft}m`
  }

  // macOS: el texto se ve junto al ícono en la barra de menú
  tray.setTitle(` ${label}`)
  // Windows: no hay texto en la bandeja, así que el contexto va en el tooltip (hover)
  const modeTag =
    settings.mode === 'pomodoro'
      ? `Pomodoro ${pomodoroCount % settings.cyclesBeforeLongBreak}/${settings.cyclesBeforeLongBreak}`
      : 'Salud'
  tray.setToolTip(`Pausas Activas (${modeTag}) — ${dndActive() ? 'No molestar' : label}`)
}

function buildTrayMenu(): Menu {
  const t = todayStat()
  const streak = currentStreak()

  return Menu.buildFromTemplate([
    // Aviso de actualización (solo aparece cuando hay una versión nueva)
    ...(availableUpdate
      ? [
          {
            label: `⬇️  Descargar v${availableUpdate}`,
            click: () => shell.openExternal(LANDING_URL)
          },
          { type: 'separator' as const }
        ]
      : []),

    // ── Estadísticas de hoy ──
    { label: `Hoy: ${t.completed} ✓  ·  ${t.skipped} saltadas`, enabled: false },
    { label: `Racha: ${streak} día${streak === 1 ? '' : 's'} ${streak > 0 ? '🔥' : ''}`, enabled: false },
    { label: 'Ver estadísticas…', click: () => openStatsWindow() },
    { type: 'separator' },

    // ── Modo ──
    {
      label: 'Modo',
      submenu: [
        {
          label: 'Salud (pausas por tiempo activo)',
          type: 'radio' as const,
          checked: settings.mode === 'health',
          click: () => setMode('health')
        },
        {
          label: 'Pomodoro (ciclos de foco)',
          type: 'radio' as const,
          checked: settings.mode === 'pomodoro',
          click: () => setMode('pomodoro')
        }
      ]
    },
    settings.mode === 'pomodoro'
      ? { label: `Foco: ${settings.workMinutes} min  ·  ciclo ${pomodoroCount % settings.cyclesBeforeLongBreak}/${settings.cyclesBeforeLongBreak}`, enabled: false }
      : { label: `Trabajo: ${settings.workMinutes} min`, enabled: false },
    { label: `Pausa: ${settings.breakMinutes} min`, enabled: false },
    { type: 'separator' },

    { label: 'Iniciar pausa ahora', click: () => triggerBreak() },
    {
      label: 'Resetear timer',
      click: () => {
        activeSeconds = 0
        snoozedUntil = 0
        meetingUntil = 0
        resetWarnings()
        updateTray()
      }
    },
    { type: 'separator' },

    // ── No molestar ──
    ...(dndActive()
      ? [
          {
            label: 'Desactivar No molestar',
            click: () => setDnd('off')
          }
        ]
      : [
          {
            label: 'No molestar',
            submenu: [
              { label: '30 minutos', click: () => setDnd(30) },
              { label: '1 hora', click: () => setDnd(60) },
              { label: '2 horas', click: () => setDnd(120) },
              { label: 'Hasta que lo apague', click: () => setDnd('forever') }
            ]
          }
        ]),
    {
      label: 'Posponer pausa en reuniones',
      type: 'checkbox' as const,
      checked: settings.autoDndInMeetings,
      click: (item) => {
        settings.autoDndInMeetings = item.checked
        if (!item.checked) meetingUntil = 0 // al apagarlo, no dejar una pausa colgada
        saveSettings(settings)
      }
    },
    { type: 'separator' },

    // ── Ajustes de duración ──
    {
      label: settings.mode === 'pomodoro' ? 'Duración del foco' : 'Intervalo de trabajo',
      submenu: [15, 20, 25, 30, 45, 50].map((min) => ({
        label: `${min} minutos`,
        type: 'radio' as const,
        checked: settings.workMinutes === min,
        click: () => {
          settings.workMinutes = min
          saveSettings(settings)
          activeSeconds = 0
          resetWarnings()
          updateTray()
          tray?.setContextMenu(buildTrayMenu())
        }
      }))
    },
    {
      label: 'Duración de pausa',
      submenu: [3, 5, 10, 15].map((min) => ({
        label: `${min} minutos`,
        type: 'radio' as const,
        checked: settings.breakMinutes === min,
        click: () => {
          settings.breakMinutes = min
          saveSettings(settings)
          tray?.setContextMenu(buildTrayMenu())
        }
      }))
    },
    ...(settings.mode === 'pomodoro'
      ? [
          {
            label: 'Descanso largo',
            submenu: [10, 15, 20, 30].map((min) => ({
              label: `${min} minutos`,
              type: 'radio' as const,
              checked: settings.longBreakMinutes === min,
              click: () => {
                settings.longBreakMinutes = min
                saveSettings(settings)
                tray?.setContextMenu(buildTrayMenu())
              }
            }))
          },
          {
            label: 'Descanso largo cada',
            submenu: [3, 4, 5, 6].map((n) => ({
              label: `${n} pomodoros`,
              type: 'radio' as const,
              checked: settings.cyclesBeforeLongBreak === n,
              click: () => {
                settings.cyclesBeforeLongBreak = n
                saveSettings(settings)
                tray?.setContextMenu(buildTrayMenu())
              }
            }))
          }
        ]
      : []),
    { type: 'separator' },

    // ── Recordatorios (micro-pausas) ──
    {
      label: 'Recordatorios',
      submenu: [
        {
          label: 'Descanso visual (20-20-20)',
          type: 'checkbox' as const,
          checked: settings.eyeReminder,
          click: (item) => {
            settings.eyeReminder = item.checked
            eyeSeconds = 0
            saveSettings(settings)
          }
        },
        {
          label: 'Tomar agua (cada hora)',
          type: 'checkbox' as const,
          checked: settings.hydrationReminder,
          click: (item) => {
            settings.hydrationReminder = item.checked
            hydrationSeconds = 0
            saveSettings(settings)
          }
        }
      ]
    },
    { type: 'separator' },

    {
      label: 'Abrir al iniciar el computador',
      type: 'checkbox' as const,
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked })
        tray?.setContextMenu(buildTrayMenu())
      }
    },
    { type: 'separator' },
    { label: `Pausas Activas v${app.getVersion()}`, enabled: false },
    { label: 'Salir', click: () => app.quit() }
  ])
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide()

  // Círculo azul como ícono del tray en ambos sistemas.
  // El import `?asset` empaqueta tray.png y devuelve una ruta válida en dev y prod
  // (antes apuntaba a resources/, que no se incluye en el build → ícono vacío en Windows).
  const trayImg = nativeImage.createFromPath(trayIcon)
  const icon =
    process.platform === 'darwin'
      ? trayImg.resize({ width: 16, height: 16 }) // tamaño de la barra de menú
      : trayImg

  tray = new Tray(icon)
  tray.setContextMenu(buildTrayMenu())

  updateTray()
  startActivityTimer()
  setupAutoUpdater((version) => {
    availableUpdate = version
    tray?.setContextMenu(buildTrayMenu())
  })

  // El menú muestra las stats del día → refrescarlo al terminar/saltar/posponer una pausa
  ipcMain.on('break:complete', () => {
    recordCompleted()
    endBreak()
    tray?.setContextMenu(buildTrayMenu())
  })
  ipcMain.on('break:skip', () => {
    recordSkipped()
    endBreak()
    tray?.setContextMenu(buildTrayMenu())
  })
  ipcMain.on('break:snooze', () => {
    recordSnoozed()
    snoozeBreak(settings.snoozeMinutes)
    tray?.setContextMenu(buildTrayMenu())
  })

  // La ventana de estadísticas pide el resumen
  ipcMain.handle('stats:get', () => summary())
})

app.on('window-all-closed', () => { /* vive en el tray */ })
app.on('before-quit', () => { tray?.destroy() })
