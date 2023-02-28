import '../styles/globals.css'
import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import type { AppProps } from 'next/app'
import Layout from 'components/Website/Layout'
import { QueryClientProvider, queryClient } from 'polarkit/api'

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  let getLayout = Component.getLayout
  if (!Component.getLayout) {
    getLayout = (page: ReactElement) => <Layout>{page}</Layout>
  }

  return (
    <QueryClientProvider client={queryClient}>
      {getLayout(<Component {...pageProps} />)}
    </QueryClientProvider>
  )
}

export default MyApp
