import { useEffect, useRef, useState } from 'react'
import defaultWallpaper from '../totoro025.jpg'
import PomodoroTimer from './components/PomodoroTimer'
import WallpaperControls from './components/WallpaperControls'
import { loadStoredWallpaper } from './utils/wallpaperStorage'

export default function App() {
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(null)
  const customWallpaperUrlRef = useRef(null)
  const wallpaperChangeRef = useRef(0)

  function replaceCustomWallpaper(blob) {
    wallpaperChangeRef.current += 1
    const nextUrl = URL.createObjectURL(blob)
    if (customWallpaperUrlRef.current) URL.revokeObjectURL(customWallpaperUrlRef.current)
    customWallpaperUrlRef.current = nextUrl
    setCustomWallpaperUrl(nextUrl)
  }

  function restoreDefaultWallpaper() {
    wallpaperChangeRef.current += 1
    if (customWallpaperUrlRef.current) URL.revokeObjectURL(customWallpaperUrlRef.current)
    customWallpaperUrlRef.current = null
    setCustomWallpaperUrl(null)
  }

  useEffect(() => {
    let isMounted = true
    const loadVersion = wallpaperChangeRef.current

    loadStoredWallpaper().then((record) => {
      if (!isMounted || !record || loadVersion !== wallpaperChangeRef.current) return
      replaceCustomWallpaper(record.blob)
    }).catch(() => {
      // The bundled wallpaper remains available if browser storage cannot be read.
    })

    return () => {
      isMounted = false
      if (customWallpaperUrlRef.current) URL.revokeObjectURL(customWallpaperUrlRef.current)
    }
  }, [])

  const wallpaperUrl = customWallpaperUrl ?? defaultWallpaper

  return (
    <>
      <div
        className="wallpaper-background"
        style={{ backgroundImage: `url(${wallpaperUrl})` }}
        aria-hidden="true"
      />

      <main className="app-shell">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="LiffyTimer home">LiffyTimer</a>
          <WallpaperControls
            hasCustomWallpaper={customWallpaperUrl !== null}
            onApply={replaceCustomWallpaper}
            onRestore={restoreDefaultWallpaper}
          />
        </header>

        <PomodoroTimer />
      </main>
    </>
  )
}
