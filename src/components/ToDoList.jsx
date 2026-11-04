import { useEffect, useRef, useState } from 'react'

const TODO_STORAGE_KEY = 'liffy:todos'

function loadToDoList() {
  try {
    const storedValue = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(storedValue)) return []

    const usedIds = new Set()
    let fallbackId = 0

    return storedValue.flatMap((item) => {
      if (!item || typeof item.desc !== 'string' || !item.desc.trim()) return []

      let id = Number(item.id)
      if (!Number.isSafeInteger(id) || id < 0 || usedIds.has(id)) {
        while (usedIds.has(fallbackId)) fallbackId += 1
        id = fallbackId
      }

      usedIds.add(id)
      fallbackId = Math.max(fallbackId, id + 1)

      return [{
        id,
        desc: item.desc.trim(),
        completed: item.completed === true,
      }]
    })
  } catch {
    return []
  }
}

function saveToDoList(toDoList) {
  try {
    window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(toDoList))
  } catch {
    // Keep the list usable when browser storage is unavailable.
  }
}

export default function ToDoList() {
  const [toDoList, setToDoList] = useState(loadToDoList)
  const [task, setTask] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editTask, setEditTask] = useState('')
  const editInputRef = useRef(null)
  const cancelEditRef = useRef(false)
  const nextIdRef = useRef(
    toDoList.reduce((nextId, item) => Math.max(nextId, item.id + 1), 0),
  )

  useEffect(() => {
    saveToDoList(toDoList)
  }, [toDoList])

  useEffect(() => {
    if (editingId === null) return
    editInputRef.current?.focus()
    editInputRef.current?.select()
  }, [editingId])

  function handleDelete(id) {
    setToDoList((current) => current.filter((item) => item.id !== id))
  }

  function handleComplete(id) {
    setToDoList((current) => current.map((item) => (
      item.id === id ? { ...item, completed: !item.completed } : item
    )))
  }

  function handleStartEdit(item) {
    cancelEditRef.current = false
    setEditingId(item.id)
    setEditTask(item.desc)
  }

  function handleSaveEdit(id, description) {
    const updatedDescription = description.trim()
    if (updatedDescription) {
      setToDoList((current) => current.map((item) => (
        item.id === id ? { ...item, desc: updatedDescription } : item
      )))
    }
    setEditingId(null)
    setEditTask('')
  }

  function handleEditBlur(id, description) {
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      return
    }
    handleSaveEdit(id, description)
  }

  function handleEditKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      cancelEditRef.current = true
      setEditingId(null)
      setEditTask('')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const description = task.trim()
    if (!description) return

    const id = nextIdRef.current
    nextIdRef.current += 1
    setToDoList((current) => [...current, { desc: description, completed: false, id }])
    setTask('')
  }

  const listItems = toDoList
    .filter((item) => {
      if (filter === 'completed') return item.completed
      if (filter === 'incomplete') return !item.completed
      return true
    })
    .map((item) => (
      <li className={`todo-item${item.completed ? ' todo-item--completed' : ''}`} key={item.id}>
        <button
          className="todo-item__complete"
          type="button"
          aria-label={item.completed ? `Mark ${item.desc} incomplete` : `Mark ${item.desc} complete`}
          aria-pressed={item.completed}
          onClick={() => handleComplete(item.id)}
        >
          <span aria-hidden="true">{item.completed ? '✓' : ''}</span>
        </button>
        {editingId === item.id ? (
          <input
            ref={editInputRef}
            className="todo-item__edit"
            type="text"
            value={editTask}
            aria-label={`Edit ${item.desc}`}
            onChange={(event) => setEditTask(event.target.value)}
            onBlur={(event) => handleEditBlur(item.id, event.target.value)}
            onKeyDown={handleEditKeyDown}
          />
        ) : (
          <button
            className={`todo-item__text todo-item__text-button${item.completed ? ' todo-item__text--completed' : ''}`}
            type="button"
            aria-label={`Edit ${item.desc}`}
            onClick={() => handleStartEdit(item)}
          >
            {item.desc}
          </button>
        )}

        <button
          className="todo-item__delete"
          type="button"
          aria-label={`Delete ${item.desc}`}
          onClick={() => handleDelete(item.id)}
        >
          ×
        </button>
      </li>
    ))

  return (
    <div className="todo-list">
      <div className="todo-list__header">
        <h2>To-do list</h2>
        <label className="todo-filter">
          <span className="sr-only">Filter tasks</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">all</option>
            <option value="incomplete">incomplete</option>
            <option value="completed">completed</option>
          </select>
        </label>
      </div>
      <form className="todo-form" onSubmit={handleSubmit}>
        <input
          className="todo-form__input"
          type="text"
          value={task}
          aria-label="New task"
          placeholder="Add a task"
          onChange={(event) => setTask(event.target.value)}
        />
        <button className="todo-form__add" type="submit" aria-label="Add task">+</button>
      </form>
      <ul className="todo-items">
        {listItems}
      </ul>
    </div>
  )
}
