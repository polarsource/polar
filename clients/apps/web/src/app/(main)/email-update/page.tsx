'use client'

import EmailUpdateForm from "@/components/Form/EmailUpdateForm"


export default async function Page({
  searchParams: { return_to, ...rest },
}: {
  searchParams: {
    return_to?: string
  }
}) {
  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="rounded-4xl dark:bg-polar-900 shadow-3xl flex w-full max-w-md flex-col justify-between gap-16 bg-gray-50 p-12">
        <EmailUpdateForm></EmailUpdateForm>        
      </div>
    </div>
  )
}
