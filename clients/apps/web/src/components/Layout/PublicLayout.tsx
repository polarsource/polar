import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import Footer from '../Organization/Footer'
import EmptyLayout from './EmptyLayout'

const PublicLayout = ({
  children,
  wide,
}: PropsWithChildren<{
  wide?: boolean
}>) => {
  return (
    <EmptyLayout>
      <div
        className={twMerge(
          'mb:mt-12 mb:mb-24 mx-auto mb-16 mt-8 flex w-full flex-col space-y-8 px-2 md:space-y-12 lg:px-0',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
        )}
      >
        {children}
      </div>
      <Footer wide={wide} />
    </EmptyLayout>
  )
}

export default PublicLayout
