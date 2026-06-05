import { autoUpdater } from 'electron-updater'
import { Notification, dialog, app } from 'electron'
import { is } from '@electron-toolkit/utils'

export function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', ({ version }) => {
    new Notification({
      title: 'Actualización disponible',
      body: `Versión ${version} descargándose en segundo plano.`
    }).show()
  })

  autoUpdater.on('update-downloaded', ({ version }) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${version} está lista para instalar.`,
        buttons: ['Instalar y reiniciar', 'Después']
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  // Revisar al abrir y luego cada 4 horas
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}
