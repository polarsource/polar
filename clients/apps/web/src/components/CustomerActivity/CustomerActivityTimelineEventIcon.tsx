import type { SvgIconComponent } from '@mui/icons-material'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import {
  EventTone,
  getEventIconComponent,
  getEventTone,
  TimelineEventContext,
} from './timeline-utils'

export function CustomerActivityTimelineEventIcon({
  event,
}: {
  event: TimelineEventContext
}) {
  const iconComponent = getEventIconComponent(event)
  const toneClasses = getToneClasses(getEventTone(event))

  return (
    <span
      className={`dark:ring-polar-900 inline-flex size-6 items-center justify-center rounded-full ring-1 ring-white ${toneClasses.background}`}
    >
      {renderEventIcon(iconComponent, toneClasses.icon)}
    </span>
  )
}

function renderEventIcon(icon: SvgIconComponent, iconClassName: string) {
  if (icon === AllInclusiveOutlined) {
    return (
      <AllInclusiveOutlined
        fontSize="inherit"
        className={`text-sm ${iconClassName}`}
      />
    )
  }

  if (icon === HistoryOutlined) {
    return (
      <HistoryOutlined
        fontSize="inherit"
        className={`text-sm ${iconClassName}`}
      />
    )
  }

  if (icon === SpeedOutlined) {
    return (
      <SpeedOutlined
        fontSize="inherit"
        className={`text-sm ${iconClassName}`}
      />
    )
  }

  return (
    <ReceiptLongOutlined
      fontSize="inherit"
      className={`text-sm ${iconClassName}`}
    />
  )
}

function getToneClasses(tone: EventTone): { icon: string; background: string } {
  if (tone === 'positive') {
    return {
      icon: 'text-emerald-600 dark:text-emerald-300',
      background: 'bg-emerald-100 dark:bg-emerald-950/50',
    }
  }

  if (tone === 'warning') {
    return {
      icon: 'text-amber-600 dark:text-amber-300',
      background: 'bg-amber-100 dark:bg-amber-950/50',
    }
  }

  if (tone === 'danger') {
    return {
      icon: 'text-rose-600 dark:text-rose-300',
      background: 'bg-rose-100 dark:bg-rose-950/50',
    }
  }

  return {
    icon: 'text-gray-600 dark:text-polar-200',
    background: 'bg-gray-100 dark:bg-polar-800',
  }
}
