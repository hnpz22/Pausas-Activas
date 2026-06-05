import { contextBridge, ipcRenderer } from 'electron'

// Expone solo lo necesario al renderer — sin acceso directo a Node.js
contextBridge.exposeInMainWorld('breakAPI', {
  // Renderer escucha cuando inicia la pausa
  onBreakStart: (cb: (data: { breakSeconds: number; workMinutes: number }) => void) => {
    ipcRenderer.on('break:start', (_event, data) => cb(data))
  },
  // Renderer avisa al main cuando terminó, saltó, o pospuso
  complete: () => ipcRenderer.send('break:complete'),
  skip: () => ipcRenderer.send('break:skip'),
  snooze: () => ipcRenderer.send('break:snooze')
})
