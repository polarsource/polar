import type { ReactElement } from 'react'
import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { api } from 'polarkit'
import { useAuth } from 'polarkit/hooks'
import InitLayout from 'components/Dashboard/InitLayout'

const isInstallationCallback = (query) => {
  return query.provider === 'github' && query.installation_id
}

const InitInstallationPage: NextPage = ({ query }) => {
  const { session } = useAuth()
  const [installed, setInstalled] = useState(false)

  const install = async (query) => {
    return await api.integrations
      .install({
        requestBody: {
          platform: query.provider,
          external_id: parseInt(query.installation_id),
        },
      })
      .then((res) => {
        setInstalled(true)
      })
      .catch((err) => {
        setInstalled(true)
      })
  }

  useEffect(() => {
    if (isInstallationCallback(query)) {
      install(query)
      return
    }
  }, [])

  if (installed) {
    return <h1>Time to install repos</h1>
  }
  return <h1>Installing...</h1>
}

InitInstallationPage.getLayout = (page: ReactElement) => {
  return <InitLayout>{page}</InitLayout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default InitInstallationPage
