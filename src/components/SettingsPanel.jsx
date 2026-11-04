import { useEffect, useState } from 'react'

const fields = [
  ['focus', 'Focus'],
  ['shortBreak', 'Short break'],
  ['longBreak', 'Long break'],
]

export default function SettingsPanel({ settings, isActive, onSave }) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(settings)

  useEffect(() => setDraft(settings), [settings])

  function handleSubmit(event) {
    event.preventDefault()
    onSave(draft)
    setIsOpen(false)
  }

  return (
    <div className="settings-wrap">
      <button
        className="icon-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="timer-settings"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">•••</span>
        <span className="sr-only">Timer settings</span>
      </button>

      {isOpen && (
        <form id="timer-settings" className="settings-panel" onSubmit={handleSubmit}>
          <div className="settings-heading">
            <div>
              
              <h2>Durations</h2>
            </div>
            <button className="close-button" type="button" onClick={() => setIsOpen(false)} aria-label="Close settings">×</button>
          </div>

          <div className="setting-fields">
            {fields.map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <span className="number-input">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    required
                    value={draft[key]}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))}
                  />
                  <span>min</span>
                </span>
              </label>
            ))}
          </div>

          <p className="settings-help">
            {isActive
              ? 'Your current countdown will stay unchanged. New times apply to the next session or reset.'
              : 'Changes apply immediately to the selected timer.'}
          </p>
          <button className="save-button" type="submit">Save durations</button>
        </form>
      )}
    </div>
  )
}
