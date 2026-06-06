import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  powerMonitor,
  screen
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { setupAutoUpdater } from './updater'
import trayIcon from '../../resources/tray.png?asset'

// ─── Settings ────────────────────────────────────────────────────────────────

interface Settings {
  workMinutes: number
  breakMinutes: number
  snoozeMinutes: number
}

const DEFAULTS: Settings = { workMinutes: 25, breakMinutes: 5, snoozeMinutes: 3 }

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

// ─── Estado global ────────────────────────────────────────────────────────────

let tray: Tray | null = null
let breakWindow: BrowserWindow | null = null
let settings = loadSettings()

if (is.dev) {
  settings.workMinutes = DEV_WORK_MINUTES
  settings.breakMinutes = DEV_BREAK_MINUTES
}

let activeSeconds = 0
let onBreak = false
let snoozedUntil = 0

// Segundos restantes que disparan una notificación de aviso
// Prod: a los 5 min, 2 min y 1 min antes
// Dev:  a los 30s y 10s antes (trabajo es de 60s total)
const WARN_THRESHOLDS_S = is.dev ? [30, 10] : [5 * 60, 2 * 60, 60]
const sentWarnings = new Set<number>()

const CHECK_INTERVAL_MS = is.dev ? 5_000 : 30_000
const IDLE_THRESHOLD_S = 5 * 60

// ─── Notificaciones de aviso ──────────────────────────────────────────────────

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
    breakWindow?.webContents.send('break:start', {
      breakSeconds: settings.breakMinutes * 60,
      workMinutes: settings.workMinutes
    })
  })
}

function closeBreakWindow(): void {
  breakWindow?.close()
  breakWindow = null
}

// ─── Lógica de timer ─────────────────────────────────────────────────────────

function triggerBreak(): void {
  onBreak = true
  activeSeconds = 0
  resetWarnings()
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

function startActivityTimer(): void {
  setInterval(() => {
    if (onBreak) return
    if (snoozedUntil > Date.now()) return

    const idleSecs = powerMonitor.getSystemIdleTime()

    if (idleSecs > IDLE_THRESHOLD_S) {
      if (activeSeconds > 0) {
        activeSeconds = 0
        resetWarnings()
        updateTray()
      }
      return
    }

    activeSeconds += CHECK_INTERVAL_MS / 1000
    checkWarnings()
    updateTray()

    if (activeSeconds >= settings.workMinutes * 60) {
      triggerBreak()
    }
  }, CHECK_INTERVAL_MS)
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function updateTray(): void {
  if (!tray) return

  let label: string
  if (onBreak) {
    label = 'Pausa'
  } else if (snoozedUntil > Date.now()) {
    const left = Math.ceil((snoozedUntil - Date.now()) / 60000)
    label = `~${left}m`
  } else {
    const remaining = settings.workMinutes * 60 - activeSeconds
    const minutesLeft = Math.max(0, Math.ceil(remaining / 60))
    // Cambia el indicador cuando quedan pocos minutos
    const warningZone = is.dev ? remaining <= 30 : remaining <= 5 * 60
    label = warningZone ? `!! ${minutesLeft}m` : `${minutesLeft}m`
  }

  // macOS: el texto se ve junto al ícono en la barra de menú
  tray.setTitle(` ${label}`)
  // Windows: no hay texto en la bandeja, así que el contador va en el tooltip (hover)
  tray.setToolTip(`Pausas Activas — ${label}`)
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: `Trabajo: ${settings.workMinutes} min`, enabled: false },
    { label: `Pausa: ${settings.breakMinutes} min`, enabled: false },
    { type: 'separator' },
    { label: 'Iniciar pausa ahora', click: () => triggerBreak() },
    {
      label: 'Resetear timer',
      click: () => {
        activeSeconds = 0
        snoozedUntil = 0
        resetWarnings()
        updateTray()
      }
    },
    { type: 'separator' },
    {
      label: 'Intervalo de trabajo',
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
  setupAutoUpdater()

  ipcMain.on('break:complete', () => endBreak())
  ipcMain.on('break:skip', () => endBreak())
  ipcMain.on('break:snooze', () => snoozeBreak(settings.snoozeMinutes))
})

app.on('window-all-closed', () => { /* vive en el tray */ })
app.on('before-quit', () => { tray?.destroy() })
