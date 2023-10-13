'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import PaymentMethodSettings from '@/components/Settings/PaymentMethodSettings'

export default function Page() {
  return (
    <div className="relative z-0">
      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Signin connections"
            description="Connect external accounts for authenticating to Polar."
          />
          <AuthenticationSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Email notifications"
            description="Polar will send emails for the notifications enabled below."
          />
          <NotificationSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Access Tokens"
            description="Manage access tokens which can be used to authenticate you with the Polar SDK."
          />
          <AccessTokensSettings />
        </Section>
      </div>
    </div>
  )
}

const Section = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-8 flex flex-col space-x-12 space-y-4 pt-8 xl:flex-row xl:space-y-0">
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
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
