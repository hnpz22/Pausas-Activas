import { autoUpdater } from 'electron-updater'
import { Notification, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

// Página de descarga (GitHub Pages). El usuario baja el .dmg/.exe nuevo desde acá.
export const LANDING_URL = 'https://hnpz22.github.io/Pausas-Activas'

/**
 * La app NO está firmada, así que no podemos instalar actualizaciones
 * automáticamente: macOS rechaza el paquete sin firma (`Could not get code
 * signature`) y en Windows SmartScreen interrumpe. Pero *detectar* que existe
 * una versión nueva (leer `latest-mac.yml` / `latest.yml` del release) NO
 * necesita firma. Así que solo avisamos y mandamos al usuario a descargar:
 *  - `autoDownload = false` → nunca intentamos descargar/instalar (evita el error de firma).
 *  - al haber versión nueva: notificación nativa (banner) + callback para el ítem del tray.
 * Ambos abren la landing con `shell.openExternal`.
 */
export function setupAutoUpdater(onUpdateAvailable: (version: string) => void): void {
  if (is.dev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', ({ version }) => {
    const notification = new Notification({
      title: 'Pausas Activas — actualización disponible',
      body: `Versión ${version} lista. Click aquí para descargarla.`
    })
    notification.on('click', () => {
      shell.openExternal(LANDING_URL)
    })
    notification.show()

    // Deja el aviso persistente en el menú del tray (por si pierden la notificación)
    onUpdateAvailable(version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  // Revisar al abrir y luego cada 4 horas. .catch() porque sin firma el check
  // puede registrar un error inofensivo; nunca debe tumbar la app.
  autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err))
  setInterval(
    () => autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err)),
    4 * 60 * 60 * 1000
  )
}
