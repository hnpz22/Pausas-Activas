/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.pausasactivas.app',
  productName: 'Pausas Activas',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  // `out/**` = código compilado. `resources/**` = assets que el main carga en runtime
  // (tray.png): el import `?asset` los referencia como `../../resources/...`, así que
  // deben viajar dentro del paquete o el ícono del tray sale vacío en producción.
  files: ['out/**/*', 'resources/**'],
  asarUnpack: ['resources/**'],

  // macOS: un solo .dmg que corre en arm64 (M1/M2/M3/M4) e Intel
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['universal'] }
    ],
    // Nombre fijo para que coincida con el enlace de descarga en docs/index.html
    // (la URL .../releases/latest/download/<nombre> exige el nombre exacto)
    artifactName: 'Pausas-Activas-universal.${ext}'
  },

  // Windows: x64 cubre i3, i5, Ryzen, etc.
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] }
    ],
    // Nombre fijo para que coincida con el botón "Descargar para Windows"
    artifactName: 'Pausas-Activas-win-x64.${ext}'
  },

  // Auto-update via GitHub Releases (gratis)
  publish: {
    provider: 'github',
    owner: 'hnpz22',
    repo: 'pausas-activas'
  }
}
