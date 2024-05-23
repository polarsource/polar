import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { PropsWithChildren, createContext, useContext, useEffect } from 'react'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

export interface DashboardContextValue {
  showCommandPalette: () => void
  hideCommandPalette: () => void
  toggleCommandPalette: () => void
  isCommandPaletteOpen: boolean
}

const defaultDashboardContextValue: DashboardContextValue = {
  showCommandPalette: () => {},
  hideCommandPalette: () => {},
  toggleCommandPalette: () => {},
  isCommandPaletteOpen: false,
}

export const DashboardContext = createContext<DashboardContextValue>(
  defaultDashboardContextValue,
)

export const DashboardProvider = ({ children }: PropsWithChildren) => {
  const { org: organization } = useCurrentOrgAndRepoFromURL()

  const {
    isShown: isCommandPaletteOpen,
    hide: hideCommandPalette,
    show: showCommandPalette,
    toggle: toggleCommandPalette,
  } = useModal()

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isCommandPaletteOpen) return

      if (e.key === 'k' && e.metaKey) {
        showCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isCommandPaletteOpen, showCommandPalette])

  return (
    <DashboardContext.Provider
      value={{
        showCommandPalette,
        hideCommandPalette,
        toggleCommandPalette,
        isCommandPaletteOpen,
      }}
    >
      {children}

      <Modal
        isShown={isCommandPaletteOpen}
        hide={hideCommandPalette}
        modalContent={
          organization ? (
            <CommandPalette
              organization={organization}
              hide={hideCommandPalette}
            />
          ) : (
            <></>
          )
        }
      />
    </DashboardContext.Provider>
  )
}

export const useDashboard = () => useContext(DashboardContext)
