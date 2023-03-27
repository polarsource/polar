import TopbarLayout from 'components/Layout/TopbarLayout'
import type { AppProps } from 'next/app'
import { queryClient, QueryClientProvider } from 'polarkit/api'
import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import '../styles/globals.scss'

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  let getLayout = Component.getLayout
  if (!Component.getLayout) {
    getLayout = (page: ReactElement) => <TopbarLayout>{page}</TopbarLayout>
  }

  return (
    <QueryClientProvider client={queryClient}>
      {getLayout(<Component {...pageProps} />)}
    </QueryClientProvider>
  )
}

export default MyApp
