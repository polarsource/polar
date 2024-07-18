import { Organization } from '@polar-sh/sdk'
import { PropsWithChildren, createContext, useContext } from 'react'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { useCommandPaletteTrigger } from '../CommandPalette/commands/trigger'
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

export const DashboardProvider = ({
  organization,
  children,
}: PropsWithChildren<{ organization: Organization | undefined }>) => {
  const {
    isShown: isCommandPaletteOpen,
    hide: hideCommandPalette,
    show: showCommandPalette,
    toggle: toggleCommandPalette,
  } = useModal()

  useCommandPaletteTrigger(toggleCommandPalette)

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
