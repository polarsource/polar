import { useCallback, useEffect, useRef, useState } from 'react'

type ValueOrUpdater<Value> = Value | ((previous: Value) => Value)

export function useOptimisticSave<Value>(
  initial: Value,
  save: (value: Value) => Promise<boolean>,
) {
  const [value, setValue] = useState<Value>(initial)

  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const lastSavedValueRef = useRef<Value>(initial)
  const desiredValueRef = useRef<Value>(initial)
  const isSavingRef = useRef(false)

  const flush = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    try {
      while (!Object.is(desiredValueRef.current, lastSavedValueRef.current)) {
        const valueToSave = desiredValueRef.current
        let succeeded: boolean
        try {
          succeeded = await saveRef.current(valueToSave)
        } catch {
          succeeded = false
        }
        if (succeeded) {
          lastSavedValueRef.current = valueToSave
        } else {
          desiredValueRef.current = lastSavedValueRef.current
          setValue(lastSavedValueRef.current)
          break
        }
      }
    } finally {
      isSavingRef.current = false
    }
  }, [])

  const update = useCallback(
    (valueOrUpdater: ValueOrUpdater<Value>) => {
      const nextValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (previous: Value) => Value)(
              desiredValueRef.current,
            )
          : valueOrUpdater
      desiredValueRef.current = nextValue
      setValue(nextValue)
      void flush()
    },
    [flush],
  )

  return { value, update }
}
