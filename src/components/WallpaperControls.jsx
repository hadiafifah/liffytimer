import { useEffect, useRef, useState } from 'react'
import { deleteStoredWallpaper, saveStoredWallpaper } from '../utils/wallpaperStorage'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_WALLPAPER_EDGE = 2560

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.25C5 19.216 5.784 20 6.75 20h10.5c.966 0 1.75-.784 1.75-1.75V14" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7v5h5M5.6 16.2A8 8 0 1 0 6 7.4L4 9" />
    </svg>
  )
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file)
    const image = new Image()

    function releaseSourceUrl() {
      URL.revokeObjectURL(sourceUrl)
    }

    image.onload = () => {
      releaseSourceUrl()
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('The selected image has no visible dimensions'))
        return
      }
      resolve(image)
    }
    image.onerror = () => {
      releaseSourceUrl()
      reject(new Error('The selected file is not a valid image'))
    }
    image.src = sourceUrl
  })
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The wallpaper could not be processed'))
    }, 'image/webp', 0.85)
  })
}

async function prepareWallpaper(file) {
  const image = await loadImage(file)
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = Math.min(1, MAX_WALLPAPER_EDGE / longestEdge)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) throw new Error('Image processing is unavailable')
  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)
  return canvasToBlob(canvas)
}

export default function WallpaperControls({ hasCustomWallpaper, onApply, onRestore }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [message])

  async function handleFileChange(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setMessage('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage('Wallpaper images must be 10 MB or smaller.')
      return
    }

    setIsProcessing(true)
    setMessage('')
    try {
      const wallpaperBlob = await prepareWallpaper(file)
      onApply(wallpaperBlob)
      try {
        await saveStoredWallpaper(wallpaperBlob)
        setMessage('Custom wallpaper saved.')
      } catch {
        setMessage('Wallpaper applied for this session, but it could not be saved.')
      }
    } catch {
      setMessage('That image could not be used. Try a different file.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleRestore() {
    if (isProcessing) return
    onRestore()
    setIsProcessing(true)
    try {
      await deleteStoredWallpaper()
      setMessage('Default wallpaper restored.')
    } catch {
      setMessage('Default restored for this session, but storage could not be updated.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="wallpaper-controls" aria-busy={isProcessing}>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      <div className="wallpaper-action">
        <button
          className="wallpaper-button wallpaper-button--upload"
          type="button"
          aria-label="Upload custom wallpaper"
          aria-describedby="wallpaper-upload-tooltip"
          disabled={isProcessing}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
        </button>
        <span className="wallpaper-tooltip" id="wallpaper-upload-tooltip" role="tooltip">
          Upload Custom Wallpaper
        </span>
      </div>

      {hasCustomWallpaper && (
        <div className="wallpaper-action">
          <button
            className="wallpaper-button wallpaper-button--restore"
            type="button"
            aria-label="Restore default wallpaper"
            aria-describedby="wallpaper-restore-tooltip"
            disabled={isProcessing}
            onClick={handleRestore}
          >
            <RestoreIcon />
          </button>
          <span className="wallpaper-tooltip" id="wallpaper-restore-tooltip" role="tooltip">
            Restore default
          </span>
        </div>
      )}

      {message && <p className="wallpaper-message" role="status">{message}</p>}
    </div>
  )
}
