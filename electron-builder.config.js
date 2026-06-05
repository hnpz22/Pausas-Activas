/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.pausasactivas.app',
  productName: 'Pausas Activas',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  files: ['out/**/*'],

  // macOS: un solo .dmg que corre en arm64 (M1/M2/M3/M4) e Intel
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['universal'] }
    ]
  },

  // Windows: x64 cubre i3, i5, Ryzen, etc.
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] }
    ]
  },

  // Auto-update via GitHub Releases (gratis)
  publish: {
    provider: 'github',
    owner: 'hnpz22',
    repo: 'pausas-activas'
  }
}
