import { useEffect, useReducer, useRef } from 'react'

export const MODES = {
  focus: { label: 'Focus', shortLabel: 'Focus' },
  shortBreak: { label: 'Short Break', shortLabel: 'Short' },
  longBreak: { label: 'Long Break', shortLabel: 'Long' },
}

export const DEFAULT_SETTINGS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
}

const STORAGE_KEYS = {
  settings: 'liffy:settings',
  stats: 'liffy:stats',
  timer: 'liffy:timer',
}

const minutesToMs = (minutes) => minutes * 60 * 1000

function nonNegativeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The timer still works if storage is unavailable (for example, private browsing restrictions).
  }
}

function cleanSettings(value) {
  return Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS).map((mode) => {
      const duration = Number(value?.[mode])
      return [mode, Number.isFinite(duration) && duration >= 1 && duration <= 180
        ? Math.round(duration)
        : DEFAULT_SETTINGS[mode]]
    }),
  )
}

function finishTimer(state, notify = true) {
  const completedFocus = state.mode === 'focus'
  const completedFocusSessions = state.completedFocusSessions + (completedFocus ? 1 : 0)
  const nextMode = completedFocus
    ? (completedFocusSessions % 4 === 0 ? 'longBreak' : 'shortBreak')
    : 'focus'

  return {
    ...state,
    mode: nextMode,
    status: 'idle',
    remainingMs: minutesToMs(state.settings[nextMode]),
    endAt: null,
    sessionDurationMs: minutesToMs(state.settings[nextMode]),
    completedFocusSessions,
    totalFocusMs: state.totalFocusMs + (completedFocus ? state.sessionDurationMs : 0),
    completionId: notify ? state.completionId + 1 : state.completionId,
    lastCompletedMode: state.mode,
    message: completedFocus
      ? `Focus complete — ${nextMode === 'longBreak' ? 'you earned a long break.' : 'time for a short break.'}`
      : 'Break complete — ready to focus?',
  }
}

function createInitialState() {
  const settings = cleanSettings(readStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS))
  const storedStats = readStorage(STORAGE_KEYS.stats, {})
  const storedTimer = readStorage(STORAGE_KEYS.timer, {})
  const mode = MODES[storedTimer.mode] ? storedTimer.mode : 'focus'
  const status = ['running', 'paused', 'idle'].includes(storedTimer.status)
    ? storedTimer.status
    : 'idle'
  const fallbackDuration = minutesToMs(settings[mode])

  let state = {
    settings,
    mode,
    status,
    remainingMs: Number.isFinite(storedTimer.remainingMs)
      ? Math.max(0, storedTimer.remainingMs)
      : fallbackDuration,
    endAt: Number.isFinite(storedTimer.endAt) ? storedTimer.endAt : null,
    sessionDurationMs: Number.isFinite(storedTimer.sessionDurationMs)
      ? storedTimer.sessionDurationMs
      : fallbackDuration,
    completedFocusSessions: Math.floor(nonNegativeNumber(storedStats.completedFocusSessions)),
    totalFocusMs: nonNegativeNumber(storedStats.totalFocusMs),
    completionId: 0,
    lastCompletedMode: null,
    message: '',
  }

  if (state.status === 'running') {
    if (!state.endAt) {
      state = { ...state, status: 'paused' }
    } else {
      const remainingMs = state.endAt - Date.now()
      state = remainingMs <= 0
        ? finishTimer(state, false)
        : { ...state, remainingMs }
    }
  }

  return state
}

export function pomodoroReducer(state, action) {
  switch (action.type) {
    case 'START': {
      if (state.status === 'running') return state
      const remainingMs = state.remainingMs > 0
        ? state.remainingMs
        : minutesToMs(state.settings[state.mode])
      return {
        ...state,
        status: 'running',
        remainingMs,
        endAt: action.now + remainingMs,
        sessionDurationMs: state.status === 'idle'
          ? minutesToMs(state.settings[state.mode])
          : state.sessionDurationMs,
        message: '',
      }
    }
    case 'PAUSE': {
      if (state.status !== 'running') return state
      return {
        ...state,
        status: 'paused',
        remainingMs: Math.max(0, state.endAt - action.now),
        endAt: null,
      }
    }
    case 'RESET': {
      const duration = minutesToMs(state.settings[state.mode])
      return {
        ...state,
        status: 'idle',
        remainingMs: duration,
        sessionDurationMs: duration,
        endAt: null,
        message: '',
      }
    }
    case 'RESET_STATS':
      return {
        ...state,
        completedFocusSessions: 0,
        totalFocusMs: 0,
        message: '',
      }
    case 'SWITCH_MODE': {
      if (!MODES[action.mode]) return state
      const duration = minutesToMs(state.settings[action.mode])
      return {
        ...state,
        mode: action.mode,
        status: 'idle',
        remainingMs: duration,
        sessionDurationMs: duration,
        endAt: null,
        message: '',
      }
    }
    case 'TICK': {
      if (state.status !== 'running') return state
      const remainingMs = state.endAt - action.now
      return remainingMs <= 0
        ? finishTimer(state)
        : { ...state, remainingMs }
    }
    case 'UPDATE_SETTINGS': {
      const settings = cleanSettings(action.settings)
      if (state.status !== 'idle') return { ...state, settings }
      const duration = minutesToMs(settings[state.mode])
      return {
        ...state,
        settings,
        remainingMs: duration,
        sessionDurationMs: duration,
      }
    }
    default:
      return state
  }
}

export default function usePomodoro() {
  const [state, dispatch] = useReducer(pomodoroReducer, undefined, createInitialState)
  const audioContextRef = useRef(null)
  const lastNotifiedRef = useRef(state.completionId)

  const enableSound = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume()
  }

  const playNotification = () => {
    const context = audioContextRef.current
    if (!context || context.state !== 'running') return

    const startAt = context.currentTime
    ;[0, 0.18].forEach((delay, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = index === 0 ? 660 : 880
      gain.gain.setValueAtTime(0.0001, startAt + delay)
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + delay + 0.22)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt + delay)
      oscillator.stop(startAt + delay + 0.24)
    })
  }

  useEffect(() => {
    if (state.status !== 'running') return undefined

    const tick = () => dispatch({ type: 'TICK', now: Date.now() })
    tick()
    const intervalId = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [state.status, state.endAt])

  useEffect(() => {
    if (state.completionId > lastNotifiedRef.current) {
      lastNotifiedRef.current = state.completionId
      playNotification()
    }
  }, [state.completionId])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, state.settings)
  }, [state.settings])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.stats, {
      completedFocusSessions: state.completedFocusSessions,
      totalFocusMs: state.totalFocusMs,
    })
  }, [state.completedFocusSessions, state.totalFocusMs])

  const persistedRemaining = state.status === 'running' ? null : state.remainingMs
  useEffect(() => {
    writeStorage(STORAGE_KEYS.timer, {
      mode: state.mode,
      status: state.status,
      remainingMs: state.status === 'running' ? state.remainingMs : persistedRemaining,
      endAt: state.endAt,
      sessionDurationMs: state.sessionDurationMs,
    })
  }, [state.mode, state.status, state.endAt, state.sessionDurationMs, persistedRemaining])

  return {
    ...state,
    start() {
      enableSound()
      dispatch({ type: 'START', now: Date.now() })
    },
    pause() {
      dispatch({ type: 'PAUSE', now: Date.now() })
    },
    reset() {
      dispatch({ type: 'RESET' })
    },
    resetStats() {
      dispatch({ type: 'RESET_STATS' })
    },
    switchMode(mode) {
      dispatch({ type: 'SWITCH_MODE', mode })
    },
    updateSettings(settings) {
      dispatch({ type: 'UPDATE_SETTINGS', settings })
    },
  }
}
