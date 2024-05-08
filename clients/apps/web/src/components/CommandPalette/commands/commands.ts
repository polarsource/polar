export interface Command {
  name: string
  description: string
  action?: () => void
  keyboardShortcut?: (e: KeyboardEvent) => void
}

export const GLOBAL_COMMANDS = []
