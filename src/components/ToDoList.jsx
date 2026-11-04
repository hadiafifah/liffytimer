import { Fragment, useEffect, useRef, useState } from 'react'

const TODO_STORAGE_KEY = 'liffy:todos'

function loadToDoList() {
  try {
    const storedValue = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(storedValue)) return []

    const usedIds = new Set()
    let fallbackId = 0
    const items = storedValue.flatMap((item) => {
      if (!item || typeof item.desc !== 'string') return []

      let id = Number(item.id)
      if (!Number.isSafeInteger(id) || id < 0 || usedIds.has(id)) {
        while (usedIds.has(fallbackId)) fallbackId += 1
        id = fallbackId
      }

      usedIds.add(id)
      fallbackId = Math.max(fallbackId, id + 1)
      const parentId = item.parentId === null || item.parentId === undefined
        ? null
        : Number(item.parentId)

      return [{
        id,
        desc: item.desc.trim(),
        completed: item.completed === true,
        parentId: Number.isSafeInteger(parentId) && parentId >= 0 ? parentId : null,
      }]
    })

    const itemById = new Map(items.map((item) => [item.id, item]))
    const normalizedItems = items.map((item) => {
      const parent = itemById.get(item.parentId)
      return {
        ...item,
        parentId: parent && parent.id !== item.id && parent.parentId === null
          ? parent.id
          : null,
      }
    })

    return normalizedItems
      .filter((item) => item.parentId === null)
      .flatMap((parent) => [
        parent,
        ...normalizedItems.filter((item) => item.parentId === parent.id),
      ])
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

function siblingTasks(toDoList, item) {
  return toDoList.filter((candidate) => candidate.parentId === item.parentId)
}

function moveTask(toDoList, id, direction) {
  const item = toDoList.find((candidate) => candidate.id === id)
  if (!item) return toDoList

  const siblings = siblingTasks(toDoList, item)
  const currentIndex = siblings.findIndex((candidate) => candidate.id === id)
  const targetIndex = currentIndex + direction
  if (targetIndex < 0 || targetIndex >= siblings.length) return toDoList

  if (item.parentId !== null) {
    const currentListIndex = toDoList.findIndex((candidate) => candidate.id === id)
    const targetListIndex = toDoList.findIndex(
      (candidate) => candidate.id === siblings[targetIndex].id,
    )
    const reordered = [...toDoList]
    ;[reordered[currentListIndex], reordered[targetListIndex]] = [
      reordered[targetListIndex],
      reordered[currentListIndex],
    ]
    return reordered
  }

  const groups = siblings.map((parent) => [
    parent,
    ...toDoList.filter((candidate) => candidate.parentId === parent.id),
  ])
  ;[groups[currentIndex], groups[targetIndex]] = [groups[targetIndex], groups[currentIndex]]
  return groups.flat()
}

function reorderTask(toDoList, sourceId, targetId, placeAfter) {
  if (sourceId === targetId) return toDoList
  const source = toDoList.find((item) => item.id === sourceId)
  const target = toDoList.find((item) => item.id === targetId)
  if (!source || !target || source.parentId !== target.parentId) return toDoList

  if (source.parentId !== null) {
    const reordered = [...toDoList]
    const sourceIndex = reordered.findIndex((item) => item.id === sourceId)
    const [sourceItem] = reordered.splice(sourceIndex, 1)
    const targetIndex = reordered.findIndex((item) => item.id === targetId)
    reordered.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceItem)
    return reordered
  }

  const parents = toDoList.filter((item) => item.parentId === null)
  const groups = parents.map((parent) => [
    parent,
    ...toDoList.filter((item) => item.parentId === parent.id),
  ])
  const sourceIndex = groups.findIndex(([parent]) => parent.id === sourceId)
  const [sourceGroup] = groups.splice(sourceIndex, 1)
  const targetIndex = groups.findIndex(([parent]) => parent.id === targetId)
  groups.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceGroup)
  return groups.flat()
}

export default function ToDoList() {
  const [toDoList, setToDoList] = useState(loadToDoList)
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editTask, setEditTask] = useState('')
  const [subtaskParentId, setSubtaskParentId] = useState(null)
  const [subtask, setSubtask] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const editInputRef = useRef(null)
  const subtaskInputRef = useRef(null)
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

  useEffect(() => {
    if (subtaskParentId === null) return
    subtaskInputRef.current?.focus()
  }, [subtaskParentId])

  function handleDelete(id) {
    setToDoList((current) => current.filter(
      (item) => item.id !== id && item.parentId !== id,
    ))
    if (subtaskParentId === id) {
      setSubtaskParentId(null)
      setSubtask('')
    }
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

  function handleAddTask() {
    const id = nextIdRef.current
    nextIdRef.current += 1
    setToDoList((current) => [
      ...current,
      { desc: '', completed: false, id, parentId: null },
    ])
    setFilter('all')
    cancelEditRef.current = false
    setEditingId(id)
    setEditTask('')
  }

  function handleStartSubtask(parentId) {
    setSubtaskParentId(parentId)
    setSubtask('')
  }

  function handleSubtaskSubmit(event) {
    event.preventDefault()
    const description = subtask.trim()
    if (!description || subtaskParentId === null) return

    const id = nextIdRef.current
    nextIdRef.current += 1
    setToDoList((current) => {
      const next = [...current]
      let insertionIndex = next.findIndex((item) => item.id === subtaskParentId) + 1
      while (next[insertionIndex]?.parentId === subtaskParentId) insertionIndex += 1
      next.splice(insertionIndex, 0, {
        desc: description,
        completed: false,
        id,
        parentId: subtaskParentId,
      })
      return next
    })
    setSubtaskParentId(null)
    setSubtask('')
  }

  function handleMove(id, direction) {
    setToDoList((current) => moveTask(current, id, direction))
  }

  function handleDragStart(event, id) {
    if (filter !== 'all') {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
    setDraggingId(id)
  }

  function handleDragOver(event, targetId) {
    if (filter !== 'all' || draggingId === null) return
    const source = toDoList.find((item) => item.id === draggingId)
    const target = toDoList.find((item) => item.id === targetId)
    if (!source || !target || source.parentId !== target.parentId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetId(targetId)
  }

  function handleDrop(event, targetId) {
    event.preventDefault()
    const sourceId = Number(event.dataTransfer.getData('text/plain'))
    const bounds = event.currentTarget.getBoundingClientRect()
    const placeAfter = event.clientY > bounds.top + (bounds.height / 2)
    setToDoList((current) => reorderTask(current, sourceId, targetId, placeAfter))
    setDraggingId(null)
    setDropTargetId(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTargetId(null)
  }

  const visibleItems = toDoList.filter((item) => {
    if (filter === 'completed') return item.completed
    if (filter === 'incomplete') return !item.completed
    return true
  })

  const listItems = visibleItems.map((item) => {
    const canReorder = filter === 'all'
    const isSubtask = item.parentId !== null
    const taskName = item.desc || 'empty task'
    const hasTaskText = (editingId === item.id ? editTask : item.desc).trim().length > 0

    return (
      <Fragment key={item.id}>
        <li
          className={`todo-item${isSubtask ? ' todo-item--subtask' : ''}${item.completed ? ' todo-item--completed' : ''}${draggingId === item.id ? ' is-dragging' : ''}${dropTargetId === item.id ? ' is-drop-target' : ''}`}
          onDragOver={(event) => handleDragOver(event, item.id)}
          onDrop={(event) => handleDrop(event, item.id)}
        >
          <button
            className="todo-item__drag"
            type="button"
            draggable={canReorder}
            aria-label={`Drag to reorder ${taskName}. Use arrow keys to move it.`}
            title={canReorder ? 'Drag to reorder' : 'Show all tasks to reorder'}
            onDragStart={(event) => handleDragStart(event, item.id)}
            onDragEnd={handleDragEnd}
            onKeyDown={(event) => {
              if (!canReorder) return
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                handleMove(item.id, -1)
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                handleMove(item.id, 1)
              }
            }}
          >
            <span aria-hidden="true">⠿</span>
          </button>

          <button
            className="todo-item__complete"
            type="button"
            aria-label={item.completed ? `Mark ${taskName} incomplete` : `Mark ${taskName} complete`}
            aria-pressed={item.completed}
            disabled={!hasTaskText}
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
              aria-label={`Edit ${taskName}`}
              placeholder="Type your task"
              onChange={(event) => setEditTask(event.target.value)}
              onBlur={(event) => handleEditBlur(item.id, event.target.value)}
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            <button
              className={`todo-item__text todo-item__text-button${!item.desc ? ' todo-item__text--placeholder' : ''}${item.completed ? ' todo-item__text--completed' : ''}`}
              type="button"
              aria-label={`Edit ${taskName}`}
              onClick={() => handleStartEdit(item)}
            >
              {item.desc || 'Type your task'}
            </button>
          )}

          <div className="todo-item__actions">
            {!isSubtask && (
              <button
                className="todo-item__subtask"
                type="button"
                aria-label={`Add subtask to ${taskName}`}
                title="Add subtask"
                onClick={() => handleStartSubtask(item.id)}
              >
                <span aria-hidden="true">+</span>
              </button>
            )}

            <button
              className="todo-item__delete"
              type="button"
              aria-label={`Delete ${taskName}${isSubtask ? '' : ' and its subtasks'}`}
              onClick={() => handleDelete(item.id)}
            >
              ×
            </button>
          </div>
        </li>

        {subtaskParentId === item.id && (
          <li className="todo-subtask-form-row">
            <form className="todo-subtask-form" onSubmit={handleSubtaskSubmit}>
              <span className="todo-subtask-form__branch" aria-hidden="true">↳</span>
              <input
                ref={subtaskInputRef}
                type="text"
                value={subtask}
                aria-label={`New subtask for ${taskName}`}
                placeholder="Add a subtask"
                onChange={(event) => setSubtask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSubtaskParentId(null)
                    setSubtask('')
                  }
                }}
              />
              <button type="submit">Add</button>
              <button
                type="button"
                aria-label="Cancel adding subtask"
                onClick={() => {
                  setSubtaskParentId(null)
                  setSubtask('')
                }}
              >
                ×
              </button>
            </form>
          </li>
        )}
      </Fragment>
    )
  })

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
      <ul className="todo-items">
        {listItems}
      </ul>
      <button className="todo-new-task" type="button" onClick={handleAddTask}>
        <span aria-hidden="true">+</span>
        New task
      </button>
    </div>
  )
}
