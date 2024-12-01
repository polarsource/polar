import EmailUpdateForm from '@/components/Form/EmailUpdateForm'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Update email"
}

export default async function Page({
  searchParams: { return_to },
}: {
  searchParams: {
    return_to?: string
  }
}) {
  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="rounded-4xl dark:bg-polar-900 shadow-3xl flex w-full max-w-md flex-col justify-between gap-16 bg-gray-50 p-12">
        <EmailUpdateForm returnTo={return_to}></EmailUpdateForm>
      </div>
    </div>
  )
}
