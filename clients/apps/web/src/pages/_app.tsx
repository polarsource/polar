import '../styles/globals.css'
import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import type { AppProps } from 'next/app'
import AuthProvider from 'polarkit/context/auth'
import Layout from 'components/Website/Layout'
import { QueryClient, QueryClientProvider } from 'polarkit'

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const queryClient = new QueryClient()

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  let getLayout = Component.getLayout
  if (!Component.getLayout) {
    getLayout = (page: ReactElement) => <Layout>{page}</Layout>
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{getLayout(<Component {...pageProps} />)}</AuthProvider>
    </QueryClientProvider>
  )
}

export default MyApp
