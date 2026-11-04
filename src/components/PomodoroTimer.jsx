import { useState } from 'react'
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
  const isRunning = timer.status === 'running'
  const isPaused = timer.status === 'paused'
  const sessionsUntilLongBreak = 4 - (timer.completedFocusSessions % 4)
  const statsToggle = (
    <button
      className="stats-toggle"
      type="button"
      aria-expanded={showStats}
      aria-controls="focus-statistics"
      onClick={() => setShowStats((visible) => !visible)}
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
      <div className="timer-card" role="region" aria-label="Pomodoro timer">
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
          status={timer.status}
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

        {showStats && <div className="stats-toggle-row">{statsToggle}</div>}

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
          {showStats ? (
            <button
              className="reset-sessions"
              type="button"
              disabled={timer.completedFocusSessions === 0 && timer.totalFocusMs === 0}
              onClick={timer.resetStats}
            >
              <span aria-hidden="true">↺</span>
              Reset sessions
            </button>
          ) : statsToggle}
          <AmbientAudio />
        </div>
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
