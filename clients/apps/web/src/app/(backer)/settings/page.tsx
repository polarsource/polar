'use client'

import NotificationSettings from '@/components/Settings/NotificationSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'
import { ReactElement } from 'react'

export default function Page() {
  return (
    <div className="relative z-0">
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        <Section>
          <>
            <SectionDescription title="Payment methods" />
            <PaymentMethodSettings />
          </>
        </Section>

        <Section>
          <>
            <SectionDescription
              title="Email notifications"
              description="Polar will send emails for the notifications enabled below."
            />
            <NotificationSettings />
          </>
        </Section>
      </div>
    </div>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return (
    <div className="mb-4 flex flex-col space-y-4 pt-4 xl:flex-row xl:space-y-0">
      {children}
    </div>
  )
}

const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => {
  return (
    <div className="flex-shrink-0 xl:ml-8 xl:w-60">
      <h2 className="mb-2 font-medium">{title}</h2>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  )
}
