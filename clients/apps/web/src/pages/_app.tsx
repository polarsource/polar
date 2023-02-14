import '../styles/globals.css'
import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import type { AppProps } from 'next/app'
import AuthProvider from 'context/auth'
import Layout from 'components/Website/Layout'

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const MyApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  let getLayout = Component.getLayout
  if (!Component.getLayout) {
    getLayout = (page: ReactElement) => <Layout>{page}</Layout>
  }
  return <AuthProvider>{getLayout(<Component {...pageProps} />)}</AuthProvider>
}

export default MyApp
