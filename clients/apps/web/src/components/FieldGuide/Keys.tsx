import type { ReactNode } from 'react'

/** A key, drawn as a cap. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block border border-current px-[3px] font-mono text-[11px] leading-[14px] not-italic">
      {children}
    </kbd>
  )
}

export const KEY_GROUPS: [string[], string][] = [
  [['↑', '↓'], 'Scroll'],
  [['←', '→'], 'Page'],
  [['1', '2', '3'], 'To chapter'],
  [['E'], 'Emit event'],
  [['T'], 'Traffic'],
  [['R'], 'Reset ledger'],
  [['H'], 'Hide keys'],
]

/** The row of controls at the foot of the manual. */
export function KeyRow() {
  return (
    <footer className="flex shrink-0 flex-wrap gap-x-8 gap-y-3 px-7 py-4 text-[13px] text-[#d8d8d8]">
      {KEY_GROUPS.map(([keys, label]) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="flex gap-1">
            {keys.map((k) => (
              <Key key={k}>{k}</Key>
            ))}
          </span>
          <span className="text-[#7b7b7b]">{label}</span>
        </div>
      ))}
    </footer>
  )
}
