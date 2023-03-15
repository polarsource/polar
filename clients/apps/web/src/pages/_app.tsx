import Layout from 'components/Layout/Website'
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
    getLayout = (page: ReactElement) => <Layout>{page}</Layout>
  }

  return (
    <QueryClientProvider client={queryClient}>
      {getLayout(<Component {...pageProps} />)}
    </QueryClientProvider>
  )
}

export default MyApp
