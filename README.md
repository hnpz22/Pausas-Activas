# Pausas Activas

**Cross-platform desktop app that reminds office workers to take active breaks** — it lives in the system tray, and on a configurable interval throws a full-screen overlay with a guided, SVG-animated stretch to follow.

Built for a real office (RobotSchool) and shipped to both macOS and Windows with over-the-air auto-updates.

<!-- TODO: add a screenshot/GIF of the break overlay here — e.g. ![overlay](docs/overlay.png) -->

## Highlights

- **Tray-first, unobtrusive** — runs quietly in the menu bar / system tray until it's time for a break.
- **Guided break overlay** — full-screen prompt with SVG-animated exercises, so people actually do the stretch instead of dismissing a toast.
- **Auto-updates** — `electron-updater` + GitHub Releases: users get new versions automatically, no reinstall.
- **Two-platform distribution** — signed macOS and Windows builds produced from one codebase.
- **CI/CD** — GitHub Actions (`release.yml`) builds and publishes releases on tag.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | **Electron 33** (main / preload / renderer) |
| Build | **electron-vite** + **Vite 5** + TypeScript |
| UI | **React 18** |
| Packaging | **electron-builder** (macOS + Windows) |
| Updates | **electron-updater** (GitHub Releases feed) |
| CI/CD | **GitHub Actions** |

## Why it's here

This is my "not just web apps" project: it shows desktop development, native packaging and code signing, an auto-update pipeline, and a CI workflow that ships real binaries to end users.

## Development

```bash
npm install
npm run dev            # electron-vite dev

npm run dist:mac       # build + package a macOS distributable
npm run dist:win       # build + package a Windows distributable
```

---

Built by [@hnpz22](https://github.com/hnpz22).
