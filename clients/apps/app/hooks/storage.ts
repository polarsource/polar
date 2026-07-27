import * as SecureStore from 'expo-secure-store'
import { useCallback, useEffect, useReducer } from 'react'
import { Platform } from 'react-native'

// ⚠️ Changing this to a different group would make existing sessions unreadable
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  accessGroup: '55U3YA3QTA.com.polarsource.Polar',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void]

function useAsyncState<T>(
  initialValue: [boolean, T | null] = [true, null],
): UseStateHook<T> {
  return useReducer(
    (
      state: [boolean, T | null],
      action: T | null = null,
    ): [boolean, T | null] => [false, action],
    initialValue,
  ) as UseStateHook<T>
}

export async function getStorageItemAsync(key: string): Promise<string | null> {
  const value = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS)
  if (value !== null) {
    return value
  }
  return await SecureStore.getItemAsync(key)
}

export async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, value)
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e)
    }
  } else {
    if (value == null) {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS)
    } else {
      await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS)
    }
  }
}

export function useStorageState(key: string): UseStateHook<string> {
  // Public
  const [state, setState] = useAsyncState<string>()

  // Get
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          setState(localStorage.getItem(key))
        }
      } catch (e) {
        console.error('Local storage is unavailable:', e)
      }
    } else {
      getStorageItemAsync(key).then((value) => {
        setState(value)
      })
    }
  }, [key])

  // Set
  const setValue = useCallback(
    (value: string | null) => {
      setState(value)
      setStorageItemAsync(key, value)
    },
    [key],
  )

  return [state, setValue]
}
