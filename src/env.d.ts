/// <reference types="vite/client" />

// Imports de assets con electron-vite (devuelven la ruta resuelta en dev y prod)
declare module '*?asset' {
  const src: string
  export default src
}
