import PomodoroTimer from './components/PomodoroTimer'

export default function App() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="LiffyTimer home">LiffyTimer</a>
      </header>

      <PomodoroTimer />
    </main>
  )
}
