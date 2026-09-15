import { DatabaseSync } from 'node:sqlite'
import { memoryEventStorage, sqliteEventStorage } from '../src/index'
import { describeEventStorage } from './event-storage.conformance'

describeEventStorage('sqlite', () => {
  const db = new DatabaseSync(':memory:')
  return { storage: sqliteEventStorage(db), close: () => db.close() }
})

describeEventStorage('memory', () => ({ storage: memoryEventStorage() }))

// Every call settles on a later tick, like a network store would.
describeEventStorage('asynchronous memory', () => {
  const memory = memoryEventStorage()
  const later = () => new Promise((resolve) => setTimeout(resolve, 1))
  return {
    storage: {
      type: 'memory-async',
      persist: (org, events, options) =>
        later().then(() => memory.persist(org, events, options)),
      reject: (org, events) => later().then(() => memory.reject(org, events)),
      forget: (org, ids) => later().then(() => memory.forget(org, ids)),
      read: (org, range) => later().then(() => memory.read(org, range)),
    },
  }
})
