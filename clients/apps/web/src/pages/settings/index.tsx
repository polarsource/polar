import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import NotificationSettings from '@/components/Settings/NotificationSettings'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  return (
    <>
      <Head>
        <title>Polar | Settings</title>
      </Head>

      <DashboardLayout showSidebar={true}>
        <>
          <div className="relative z-0">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
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
        </>
      </DashboardLayout>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <>{page}</>
    </Gatekeeper>
  )
}

const Section = ({ children }: { children: ReactElement }) => {
  return (
    <div className="mb-4 flex flex-col space-y-4 pt-4 xl:flex-row-reverse xl:space-y-0">
      {children}
    </div>
  )
}

const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  return (
    <div className="flex-shrink-0 xl:ml-8 xl:w-60">
      <h2 className="mb-2 font-medium">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}

export default Page
