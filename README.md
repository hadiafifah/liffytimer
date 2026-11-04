# Liffy Timer

A focused Pomodoro study timer built with React and Vite.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Structure

- `src/hooks/usePomodoro.js` owns timer state, transitions, accurate end-time tracking, persistence, and the notification sound.
- `src/components/PomodoroTimer.jsx` renders the timer controls and focus statistics.
- `src/components/SettingsPanel.jsx` handles duration preferences independently from the countdown logic.
- `src/components/ToDoList.jsx` owns the persistent task list and completion state.

To-do items, timer settings, runtime state, completed sessions, cycle progress, and total focus time are stored in the browser's `localStorage`. No backend is required.
