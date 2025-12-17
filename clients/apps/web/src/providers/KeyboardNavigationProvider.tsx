'use client'

import { schemas } from '@polar-sh/client'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type PageContext =
  | { type: 'products'; organization: schemas['Organization'] }
  | { type: 'orders'; organization: schemas['Organization'] }
  | { type: 'customers'; organization: schemas['Organization'] }
  | { type: 'subscriptions'; organization: schemas['Organization'] }
  | { type: 'other' }

type SelectedItem =
  | { type: 'product'; data: schemas['Product'] }
  | { type: 'order'; data: schemas['Order'] }
  | { type: 'customer'; data: schemas['Customer'] }
  | { type: 'subscription'; data: schemas['Subscription'] }
  | null

interface KeyboardNavigationContextType {
  pageContext: PageContext
  setPageContext: (context: PageContext) => void
  selectedItem: SelectedItem
  setSelectedItem: (item: SelectedItem) => void
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  clearSelection: () => void
}

const KeyboardNavigationContext =
  createContext<KeyboardNavigationContextType | null>(null)

export const useKeyboardNavigation = () => {
  const context = useContext(KeyboardNavigationContext)
  if (!context) {
    throw new Error(
      'useKeyboardNavigation must be used within KeyboardNavigationProvider',
    )
  }
  return context
}

export const KeyboardNavigationProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [pageContext, setPageContext] = useState<PageContext>({ type: 'other' })
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const clearSelection = useCallback(() => {
    setSelectedItem(null)
    setSelectedIndex(-1)
  }, [])

  const value = useMemo(
    () => ({
      pageContext,
      setPageContext,
      selectedItem,
      setSelectedItem,
      selectedIndex,
      setSelectedIndex,
      clearSelection,
    }),
    [pageContext, selectedItem, selectedIndex, clearSelection],
  )

  return (
    <KeyboardNavigationContext.Provider value={value}>
      {children}
    </KeyboardNavigationContext.Provider>
  )
}
