import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import Footer from '../Landing/Footer'
import EmptyLayout from './EmptyLayout'

const PublicLayout = ({
  children,
  wide,
  className,
  footer = true,
}: PropsWithChildren<{
  wide?: boolean
  className?: string
  footer?: boolean
}>) => {
  return (
    <EmptyLayout>
      <div
        className={twMerge(
          'mb:mt-12 mb:mb-24 mx-auto mb-16 flex w-full flex-col space-y-8 px-4 md:space-y-12',
          wide ? 'max-w-7xl' : 'max-w-[970px]',
          className,
        )}
      >
        {children}
      </div>
      {footer && <Footer />}
    </EmptyLayout>
  )
}

export default PublicLayout
