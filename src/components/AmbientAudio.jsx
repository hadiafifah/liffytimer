import { useEffect, useRef, useState } from 'react'
import cafeSound from '../../media/sounds/cafe.mp3'
import campfireSound from '../../media/sounds/campfire.mp3'
import rainSound from '../../media/sounds/rain.mp3'

const sounds = [
  { id: 'cafe', label: 'Café', detail: 'Soft room chatter', src: cafeSound },
  { id: 'campfire', label: 'Campfire', detail: 'Warm crackling fire', src: campfireSound },
  { id: 'rain', label: 'Rain', detail: 'Steady rainfall', src: rainSound },
]

const initialSoundState = Object.fromEntries(
  sounds.map(({ id }) => [id, { active: false, playing: false, volume: 0.55 }]),
)

function AudioControlIcon({ playing }) {
  return playing ? (
    <span className="ambient-pause-icon" aria-hidden="true"><i /><i /></span>
  ) : (
    <span className="ambient-play-icon" aria-hidden="true" />
  )
}

export default function AmbientAudio() {
  const [isOpen, setIsOpen] = useState(false)
  const [soundState, setSoundState] = useState(initialSoundState)
  const containerRef = useRef(null)
  const audioRefs = useRef({})
  const audioContextRef = useRef(null)
  const sourceNodesRef = useRef({})
  const gainNodesRef = useRef({})
  const playingCount = Object.values(soundState).filter(({ playing }) => playing).length
  const activeCount = Object.values(soundState).filter(({ active }) => active).length

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => () => {
    Object.values(audioRefs.current).forEach((audio) => audio?.pause())
    Object.values(sourceNodesRef.current).forEach((source) => source?.disconnect())
    Object.values(gainNodesRef.current).forEach((gain) => gain?.disconnect())
    audioContextRef.current?.close()
  }, [])

  function ensureAudioGraph(id) {
    const audio = audioRefs.current[id]
    if (!audio) return null

    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return null
      audioContextRef.current = new AudioContext()
    }

    const context = audioContextRef.current
    if (!gainNodesRef.current[id]) {
      try {
        const source = context.createMediaElementSource(audio)
        const gain = context.createGain()
        source.connect(gain)
        gain.connect(context.destination)
        sourceNodesRef.current[id] = source
        gainNodesRef.current[id] = gain
      } catch {
        return null
      }
    }

    return { context, gain: gainNodesRef.current[id] }
  }

  function applyVolume(id, volume, smooth = false) {
    const graph = ensureAudioGraph(id)
    if (!graph) {
      const audio = audioRefs.current[id]
      if (audio) audio.volume = volume
      return null
    }

    const { context, gain } = graph
    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    if (smooth) {
      gain.gain.setTargetAtTime(volume, now, 0.015)
    } else {
      gain.gain.setValueAtTime(volume, now)
    }
    return context
  }

  function resumeAudioContext() {
    const context = audioContextRef.current
    return context?.state === 'suspended' ? context.resume() : Promise.resolve()
  }

  async function toggleSound(id) {
    const audio = audioRefs.current[id]
    const current = soundState[id]
    if (!audio) return

    if (current.playing) {
      audio.pause()
      setSoundState((state) => ({
        ...state,
        [id]: { ...state[id], active: false, playing: false },
      }))
      return
    }

    applyVolume(id, current.volume)
    const resumePromise = resumeAudioContext()
    const playPromise = audio.play()
    try {
      await Promise.all([resumePromise.catch(() => {}), playPromise])
      setSoundState((state) => ({
        ...state,
        [id]: { ...state[id], active: true, playing: true },
      }))
    } catch {
      setSoundState((state) => ({
        ...state,
        [id]: { ...state[id], active: false, playing: false },
      }))
    }
  }

  function updateVolume(id, value) {
    const volume = Math.min(1, Math.max(0, Number(value)))
    applyVolume(id, volume, true)
    setSoundState((state) => ({
      ...state,
      [id]: { ...state[id], volume },
    }))
  }

  function stopSound(id) {
    setSoundState((state) => ({
      ...state,
      [id]: { ...state[id], active: false, playing: false },
    }))
  }

  async function toggleAllSounds() {
    if (playingCount > 0) {
      sounds.forEach(({ id }) => {
        if (soundState[id].active) audioRefs.current[id]?.pause()
      })
      setSoundState((state) => Object.fromEntries(
        Object.entries(state).map(([id, value]) => [
          id,
          value.active ? { ...value, playing: false } : value,
        ]),
      ))
      return
    }

    sounds.forEach(({ id }) => {
      if (soundState[id].active) applyVolume(id, soundState[id].volume)
    })
    const resumePromise = resumeAudioContext()
    const playAttempts = sounds.map(({ id }) => {
      if (!soundState[id].active) return [id, false]
      const audio = audioRefs.current[id]
      if (!audio) return [id, false]
      return audio.play().then(
        () => [id, true],
        () => [id, false],
      )
    })
    await resumePromise.catch(() => {})
    const results = await Promise.all(playAttempts)

    const resumed = Object.fromEntries(results)
    setSoundState((state) => Object.fromEntries(
      Object.entries(state).map(([id, value]) => [
        id,
        value.active
          ? { ...value, active: resumed[id], playing: resumed[id] }
          : value,
      ]),
    ))
  }

  return (
    <div className="ambient-audio" ref={containerRef}>
      {sounds.map(({ id, label, src }) => (
        <audio
          key={id}
          ref={(audio) => { audioRefs.current[id] = audio }}
          src={src}
          loop
          preload="none"
          aria-label={`${label} ambient sound`}
          onError={() => stopSound(id)}
        />
      ))}

      {isOpen && (
        <div className="ambient-popover" id="ambient-sound-menu" role="dialog" aria-label="Ambient sounds">
          <div className="ambient-popover__heading">
            <div>
              <span className="eyebrow">Sound mixer</span>
              <h2>Ambient sounds</h2>
            </div>
            <button
              className="ambient-close"
              type="button"
              aria-label="Close ambient sounds"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="ambient-sound-list">
            {sounds.map(({ id, label, detail }) => {
              const { active, playing, volume } = soundState[id]
              return (
                <div className={`ambient-sound${active ? ' is-active' : ''}${playing ? ' is-playing' : ''}`} key={id}>
                  <div className="ambient-sound__main">
                    <button
                      className="ambient-sound__toggle"
                      type="button"
                      aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
                      aria-pressed={playing}
                      onClick={() => toggleSound(id)}
                    >
                      <AudioControlIcon playing={playing} />
                    </button>
                    <div className="ambient-sound__copy">
                      <strong>{label}</strong>
                      <span>{playing ? 'Playing' : active ? 'Paused' : detail}</span>
                    </div>
                  </div>

                  {active && (
                    <label className="ambient-volume">
                      <span>Volume</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        aria-label={`${label} volume`}
                        onInput={(event) => updateVolume(id, event.currentTarget.value)}
                      />
                      <output>{Math.round(volume * 100)}%</output>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="ambient-actions">
        <button
          className="ambient-master-toggle"
          type="button"
          aria-label={activeCount > 0
            ? (playingCount > 0 ? 'Pause all ambient sounds' : 'Play all ambient sounds')
            : 'Choose ambient sounds'}
          aria-pressed={playingCount > 0}
          onClick={activeCount > 0 ? toggleAllSounds : () => setIsOpen(true)}
        >
          <AudioControlIcon playing={playingCount > 0} />
        </button>

        <button
          className={`ambient-trigger${activeCount ? ' has-playing-sounds' : ''}`}
          type="button"
          aria-expanded={isOpen}
          aria-controls="ambient-sound-menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>Ambient sounds</span>
          {activeCount > 0 && (
            <span className="ambient-trigger__status">
              {playingCount > 0 ? `${playingCount} playing` : `${activeCount} paused`}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
