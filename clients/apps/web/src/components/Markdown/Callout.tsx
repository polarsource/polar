import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import ReportOutlined from '@mui/icons-material/ReportOutlined'
import WarningOutlined from '@mui/icons-material/WarningOutlined'
import { twMerge } from 'tailwind-merge'

export enum CalloutType {
  NOTE = 'NOTE',
  TIP = 'TIP',
  IMPORTANT = 'IMPORTANT',
  WARNING = 'WARNING',
  CAUTION = 'CAUTION',
}

export const CALLOUT_TYPE_BORDER_COLORS: Record<CalloutType, string> = {
  [CalloutType.NOTE]: 'border-blue-500',
  [CalloutType.TIP]: 'border-green-500',
  [CalloutType.IMPORTANT]: 'border-violet-500',
  [CalloutType.WARNING]: 'border-yellow-500',
  [CalloutType.CAUTION]: 'border-red-500',
}

export const CALLOUT_TYPE_TEXT_COLORS: Record<CalloutType, string> = {
  [CalloutType.NOTE]: 'text-blue-500',
  [CalloutType.TIP]: 'text-green-500',
  [CalloutType.IMPORTANT]: 'text-violet-500',
  [CalloutType.WARNING]: 'text-yellow-500',
  [CalloutType.CAUTION]: 'text-red-500',
}

export interface CalloutProps {
  type: CalloutType
  children: React.ReactNode
}

const CALLOUT_TYPE_ICON: Record<CalloutType, React.ReactNode> = {
  [CalloutType.NOTE]: <InfoOutlined />,
  [CalloutType.TIP]: <LightbulbOutlined />,
  [CalloutType.IMPORTANT]: <FeedbackOutlined />,
  [CalloutType.WARNING]: <WarningOutlined />,
  [CalloutType.CAUTION]: <ReportOutlined />,
}

const Callout: React.FC<CalloutProps> = ({ type, children }) => {
  return (
    <div
      className={twMerge(
        'border-0 border-l-4 border-solid pl-4 [&>*:nth-child(2)]:mt-2',
        CALLOUT_TYPE_BORDER_COLORS[type],
      )}
    >
      <div
        className={twMerge(
          'inline-flex items-center gap-2 font-medium',
          CALLOUT_TYPE_TEXT_COLORS[type],
        )}
      >
        {CALLOUT_TYPE_ICON[type]}
        <div className="capitalize">{type.toLowerCase()}</div>
      </div>
      {children}
    </div>
  )
}

export default Callout
