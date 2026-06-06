import { execFile } from 'child_process'

// Detección de "estás en una reunión / videollamada" SIN dependencias nativas:
// consultamos la ventana en primer plano vía comandos del propio SO. Se llama solo
// en el momento en que iría a saltar una pausa (no en polling continuo), así que el
// costo es despreciable. Cualquier fallo se traga y devuelve false (falla seguro:
// si no podemos saber, dejamos que la pausa ocurra normalmente).

// Procesos de apps de videollamada/grabación (match por nombre de proceso)
const MEETING_PROCESSES = [
  'zoom',
  'teams',
  'ms-teams',
  'msteams',
  'webex',
  'webexmta',
  'atmgr',
  'skype',
  'discord',
  'gotomeeting',
  'g2mcomm',
  'bluejeans',
  'ringcentral',
  'facetime',
  'obs64',
  'obs'
]

// Palabras en el título de la ventana (cubre llamadas en el navegador: Meet, etc.)
const MEETING_TITLES = [
  'zoom meeting',
  'microsoft teams',
  'google meet',
  'meet -',
  'webex',
  'whereby',
  'jitsi',
  'reunión',
  'meeting',
  'llamada',
  'videollamada'
]

function matchesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase()
  return needles.some((n) => h.includes(n))
}

// ── Windows: ventana en foco vía P/Invoke mínimo (proceso + título) ──
const WIN_PS = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FgWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$h = [FgWin]::GetForegroundWindow()
$procId = 0
[void][FgWin]::GetWindowThreadProcessId($h, [ref]$procId)
$p = ""
try { $p = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
$sb = New-Object System.Text.StringBuilder 512
[void][FgWin]::GetWindowText($h, $sb, 512)
Write-Output ($p + "\`t" + $sb.ToString())
`

function detectWindows(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_PS],
      { timeout: 6000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(false)
        const [proc = '', title = ''] = stdout.trim().split('\t')
        resolve(matchesAny(proc, MEETING_PROCESSES) || matchesAny(title, MEETING_TITLES))
      }
    )
  })
}

// ── macOS: app en primer plano vía lsappinfo (sin pedir permisos) ──
function detectMac(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      '/bin/sh',
      ['-c', 'lsappinfo info -only name "$(lsappinfo front)"'],
      { timeout: 4000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(false)
        // stdout típico: "LSDisplayName"="zoom.us"
        const m = stdout.match(/LSDisplayName"\s*=\s*"([^"]+)"/)
        const name = m ? m[1] : stdout
        resolve(matchesAny(name, MEETING_PROCESSES) || matchesAny(name, MEETING_TITLES))
      }
    )
  })
}

/** ¿El usuario parece estar en una reunión/videollamada ahora mismo? */
export function isInMeeting(): Promise<boolean> {
  if (process.platform === 'win32') return detectWindows()
  if (process.platform === 'darwin') return detectMac()
  return Promise.resolve(false)
}
