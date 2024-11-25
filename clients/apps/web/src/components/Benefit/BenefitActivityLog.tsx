'use client'

import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { DashboardBody } from '../Layout/DashboardLayout'

interface TimelineEvent {
  id: string
  type: 'revoked' | 'granted' | 'enabled' | 'created'
  user: {
    name: string
    avatar: string
  }
  date: string
  time: string
  title: string
  metadata: {
    fromVersion?: string
    toVersion?: string
    version?: string
    licenseKey: string
    action?: string
  }
}

export const BenefitActivityLog = () => {
  const { currentUser } = useAuth()

  const events: TimelineEvent[] = [
    {
      id: '1',
      type: 'revoked',
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      date: 'Jan 15th 2025',
      time: '08:15 AM',
      title: 'App Basic License was revoked',
      metadata: {
        fromVersion: 'App Pro Version',
        toVersion: 'App Basic Version',
        licenseKey: '*****-EAC04D',
        action: 'Downgrade',
      },
    },
    {
      id: '2',
      type: 'granted',
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      date: 'Jan 15th 2025',
      time: '08:15 AM',
      title: 'App Pro License was granted',
      metadata: {
        version: 'App Pro Version',
        licenseKey: '*****-EAC04D',
        action: 'Purchase',
      },
    },
    {
      id: '3',
      type: 'enabled',
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      date: 'Dec 15th 2024',
      time: '11:23 AM',
      title: 'App Pro License was enabled on product App Pro Version',
      metadata: {
        version: 'App Pro Version',
        action: 'Enabled',
      },
    },
    {
      id: '4',
      type: 'created',
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      date: 'Dec 15th 2024',
      time: '11:20 AM',
      title: 'App Pro License was created',
      metadata: {},
    },
  ]

  return (
    <DashboardBody>
      <div className="flex">
        <div className="relative">
          {events.map((event, index) => (
            <div key={event.id} className="relative pb-4">
              {index < events.length - 1 && (
                <div
                  className="dark:border-polar-800 absolute -bottom-8 left-4 top-8 border border-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start gap-x-4 space-x-3">
                <div className="relative pt-5">
                  {event.type === 'revoked' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 backdrop-blur-2xl dark:bg-red-900/20">
                      <CloseOutlined className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                  {event.type === 'granted' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 backdrop-blur-2xl dark:bg-green-900/20">
                      <CheckOutlined className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  {(event.type === 'enabled' || event.type === 'created') && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 backdrop-blur-2xl dark:bg-blue-900/20">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
                <div className="dark:bg-polar-800 flex flex-grow flex-col gap-y-4 rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar
                        className="h-8 w-8"
                        avatar_url={event.user.avatar}
                        name={event.user.name}
                      />
                      <span className="dark:text-polar-500 text-sm text-gray-500">
                        {event.user.name}
                      </span>
                    </div>
                    <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                      {event.date} · {event.time}
                    </span>
                  </div>
                  <h3 className="dark:text-polar-100 text-base text-gray-900">
                    {event.title}
                  </h3>
                  <div className="flex items-center justify-between gap-6 font-mono">
                    <div className="flex items-center gap-3 rounded-full p-1 pr-4">
                      {event.metadata.action && (
                        <Pill
                          color={
                            event.type === 'revoked'
                              ? 'red'
                              : event.type === 'granted'
                                ? 'green'
                                : 'blue'
                          }
                        >
                          {event.metadata.action}
                        </Pill>
                      )}
                      {event.metadata.fromVersion &&
                        event.metadata.toVersion && (
                          <div className="dark:text-polar-500 flex items-center gap-x-2 text-xs text-gray-500">
                            <span>{event.metadata.fromVersion}</span>
                            <svg
                              className="dark:text-polar-500 h-4 w-4 text-gray-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                              />
                            </svg>
                            <span>{event.metadata.toVersion}</span>
                          </div>
                        )}
                      {event.metadata.version && (
                        <span className="dark:text-polar-500 text-xs text-gray-500">
                          {event.metadata.version}
                        </span>
                      )}
                    </div>
                    {event.metadata.licenseKey && (
                      <Pill color="gray">{event.metadata.licenseKey}</Pill>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardBody>
  )
}

import { useAuth } from '@/hooks'
import { twMerge } from 'tailwind-merge'

const Pill = ({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color: 'gray' | 'blue' | 'purple' | 'green' | 'red'
  className?: string
}) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center space-x-3 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',

        color === 'gray'
          ? 'dark:bg-polar-500/20 dark:text-polar-400 bg-gray-200 text-gray-500'
          : '',
        color === 'blue'
          ? 'bg-blue-100 text-blue-500 dark:bg-blue-500/20 dark:text-blue-500'
          : '',
        color === 'green'
          ? 'bg-green-100 text-green-500 dark:bg-green-500/20 dark:text-green-500  '
          : '',
        color === 'red'
          ? 'bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-500  '
          : '',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Pill
