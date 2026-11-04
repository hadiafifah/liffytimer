const DATABASE_NAME = 'liffy-timer'
const DATABASE_VERSION = 1
const STORE_NAME = 'preferences'
const WALLPAPER_KEY = 'customWallpaper'

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB is unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open wallpaper storage'))
    request.onblocked = () => reject(new Error('Wallpaper storage is blocked'))
  })
}

function completeTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(
      transaction.error ?? new Error('Wallpaper storage transaction failed'),
    )
    transaction.onabort = () => reject(
      transaction.error ?? new Error('Wallpaper storage transaction was aborted'),
    )
  })
}

export async function loadStoredWallpaper() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(WALLPAPER_KEY)
    const record = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not read wallpaper'))
    })

    return record?.blob instanceof Blob
      && record.blob.size > 0
      && record.blob.type.startsWith('image/')
      ? record
      : null
  } finally {
    database.close()
  }
}

export async function saveStoredWallpaper(blob) {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({
      blob,
      type: blob.type,
      updatedAt: Date.now(),
    }, WALLPAPER_KEY)
    await completeTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function deleteStoredWallpaper() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(WALLPAPER_KEY)
    await completeTransaction(transaction)
  } finally {
    database.close()
  }
}
