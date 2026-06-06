import { contextBridge, ipcRenderer } from 'electron'

export interface BreakStartData {
  breakSeconds: number
  workMinutes: number
  snoozeMinutes: number
  mode: 'health' | 'pomodoro'
  isLongBreak: boolean
  cycle: number
  cyclesBeforeLongBreak: number
}

// Expone solo lo necesario al renderer — sin acceso directo a Node.js
contextBridge.exposeInMainWorld('breakAPI', {
  // Renderer escucha cuando inicia la pausa
  onBreakStart: (cb: (data: BreakStartData) => void) => {
    ipcRenderer.on('break:start', (_event, data) => cb(data))
  },
  // Renderer avisa al main cuando terminó, saltó, o pospuso
  complete: () => ipcRenderer.send('break:complete'),
  skip: () => ipcRenderer.send('break:skip'),
  snooze: () => ipcRenderer.send('break:snooze')
})

// API de estadísticas para la ventana de stats (#stats)
contextBridge.exposeInMainWorld('statsAPI', {
  get: () => ipcRenderer.invoke('stats:get')
})
