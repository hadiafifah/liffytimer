import { useEffect, useRef, useState } from 'react'
import usePomodoro, { MODES } from '../hooks/usePomodoro'
import AmbientAudio from './AmbientAudio'
import SettingsPanel from './SettingsPanel'
import TimerDisplay from './TimerDisplay'
import ToDoList from './ToDoList'

const modeOrder = ['focus', 'shortBreak', 'longBreak']

function formatFocusTime(milliseconds) {
  const totalMinutes = Math.floor(milliseconds / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

function PlayIcon() {
  return <span className="play-icon" aria-hidden="true" />
}

function PauseIcon() {
  return <span className="pause-icon" aria-hidden="true"><i /><i /></span>
}

export default function PomodoroTimer() {
  const timer = usePomodoro()
  const [showStats, setShowStats] = useState(false)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const timerCardRef = useRef(null)
  const resetSessionsButtonRef = useRef(null)
  const cancelResetButtonRef = useRef(null)
  const isRunning = timer.status === 'running'
  const isPaused = timer.status === 'paused'
  const sessionsUntilLongBreak = 4 - (timer.completedFocusSessions % 4)

  useEffect(() => {
    if (!showResetConfirmation) return undefined

    cancelResetButtonRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowResetConfirmation(false)
        resetSessionsButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showResetConfirmation])

  function closeResetConfirmation() {
    setShowResetConfirmation(false)
    window.requestAnimationFrame(() => resetSessionsButtonRef.current?.focus())
  }

  function handleResetStats() {
    timer.resetStats()
    closeResetConfirmation()
  }

  function toggleStats() {
    if (!showStats) {
      const timerDisplay = timerCardRef.current?.querySelector('.timer-display')
      if (timerDisplay) {
        timerCardRef.current.style.setProperty(
          '--collapsed-timer-display-height',
          `${timerDisplay.getBoundingClientRect().height}px`,
        )
      }
    }
    setShowStats((visible) => !visible)
  }

  const statsToggle = (
    <button
      className="stats-toggle"
      type="button"
      aria-expanded={showStats}
      aria-controls="focus-statistics"
      onClick={toggleStats}
    >
      <span>Focus stats</span>
      <svg
        className={`stats-toggle__chevron${showStats ? ' is-open' : ''}`}
        viewBox="0 0 10 6"
        aria-hidden="true"
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </button>
  )

  return (
    <section id="top" className="timer-section">
      <div
        ref={timerCardRef}
        className={`timer-card${showStats ? ' is-stats-open' : ''}`}
        role="region"
        aria-label="Pomodoro timer"
      >
        <div className="card-topbar">
          <nav className="mode-tabs" aria-label="Timer modes">
            {modeOrder.map((mode) => (
              <button
                type="button"
                className={timer.mode === mode ? 'active' : ''}
                aria-pressed={timer.mode === mode}
                onClick={() => timer.switchMode(mode)}
                key={mode}
              >
                <span className="full-label">{MODES[mode].label}</span>
                <span className="short-label">{MODES[mode].shortLabel}</span>
              </button>
            ))}
          </nav>
          <SettingsPanel
            settings={timer.settings}
            isActive={timer.status !== 'idle'}
            onSave={timer.updateSettings}
          />
        </div>

        <TimerDisplay
          remainingMs={timer.remainingMs}
          label={MODES[timer.mode].label}
        />

        <div className="timer-actions">
          <button
            className="primary-action"
            type="button"
            onClick={isRunning ? timer.pause : timer.start}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
            {isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
          </button>
          <button className="reset-action" type="button" onClick={timer.reset}>
            <span aria-hidden="true">↻</span>
            Reset
          </button>
        </div>

        {showStats && (
          <div className="stats-toggle-row">
            {statsToggle}
            <button
              ref={resetSessionsButtonRef}
              className="reset-sessions"
              type="button"
              disabled={timer.completedFocusSessions === 0 && timer.totalFocusMs === 0}
              onClick={() => setShowResetConfirmation(true)}
            >
              <span aria-hidden="true">↺</span>
              Reset sessions
            </button>
          </div>
        )}

        {showStats && (
          <div className="stats-grid" id="focus-statistics" aria-label="Focus statistics">
            <div>
              <span className="stat-label">Focus sessions</span>
              <strong>{timer.completedFocusSessions}</strong>
              <span className="stat-detail">{sessionsUntilLongBreak} to long break</span>
            </div>
            <div>
              <span className="stat-label">Total focus</span>
              <strong>{formatFocusTime(timer.totalFocusMs)}</strong>
              <span className="stat-detail">Completed time</span>
            </div>
            <div className="cycle-stat">
              <span className="stat-label">Current cycle</span>
              <div className="cycle-dots" aria-label={`${timer.completedFocusSessions % 4} of 4 sessions in this cycle`}>
                {[0, 1, 2, 3].map((index) => (
                  <span
                    className={index < timer.completedFocusSessions % 4 ? 'filled' : ''}
                    key={index}
                  />
                ))}
              </div>
              <span className="stat-detail">Four-session cycle</span>
            </div>
          </div>
        )}

        <div className={`stats-footer${showStats ? '' : ' is-collapsed'}`}>
          {!showStats && statsToggle}
          <AmbientAudio />
        </div>

        {showResetConfirmation && (
          <div
            className="confirmation-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeResetConfirmation()
            }}
          >
            <div
              className="confirmation-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-sessions-title"
              aria-describedby="reset-sessions-description"
            >
              <span className="confirmation-dialog__icon" aria-hidden="true">↺</span>
              <h2 id="reset-sessions-title">Reset focus sessions?</h2>
              <p id="reset-sessions-description">
                This will permanently clear your completed sessions and total focus time.
              </p>
              <div className="confirmation-dialog__actions">
                <button
                  ref={cancelResetButtonRef}
                  className="confirmation-dialog__cancel"
                  type="button"
                  onClick={closeResetConfirmation}
                >
                  Keep progress
                </button>
                <button
                  className="confirmation-dialog__confirm"
                  type="button"
                  onClick={handleResetStats}
                >
                  Reset sessions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User-owned to-do implementation. */}
      <div
        id="todo-practice-root"
        className="todo-practice-root"
        aria-label="To-do list"
      >
        <ToDoList/>
      </div>
    </section>
  )
}
