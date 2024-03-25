import { twMerge } from 'tailwind-merge'

import {
  CALLOUT_TYPE_BORDER_COLORS,
  CALLOUT_TYPE_TEXT_COLORS,
  CalloutProps,
  CalloutType,
} from './renderRule'

const CALLOUT_TYPE_ICON: Record<CalloutType, React.ReactNode> = {
  [CalloutType.NOTE]: 'ℹ️',
  [CalloutType.TIP]: '💡',
  [CalloutType.IMPORTANT]: '💬',
  [CalloutType.WARNING]: '⚠️',
  [CalloutType.CAUTION]: '🚨',
}

const EmailCallout: React.FC<CalloutProps> = ({ type, children }) => {
  return (
    <div
      className={twMerge(
        'border-0 border-l-4 border-solid pl-4',
        CALLOUT_TYPE_BORDER_COLORS[type],
      )}
    >
      <div
        className={twMerge(
          'inline-flex items-center gap-2 font-medium',
          CALLOUT_TYPE_TEXT_COLORS[type],
        )}
      >
        <div>{CALLOUT_TYPE_ICON[type]}</div>
        <div className="capitalize">{type.toLowerCase()}</div>
      </div>
      {children}
    </div>
  )
}

export default EmailCallout
