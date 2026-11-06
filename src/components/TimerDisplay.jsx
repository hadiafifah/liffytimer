function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function TimerDisplay({ remainingMs, label }) {
  const time = formatTime(remainingMs)

  return (
    <div className="timer-display" aria-live="off" aria-label={`${label} timer: ${time} remaining`}>
      <time className="timer-time">{time}</time>
    </div>
  )
}
