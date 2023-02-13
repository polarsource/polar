import { requireAuth } from 'context/auth'
import { useParams } from 'react-router-dom'
import { client } from 'lib/api'

const Organization = () => {
  const { user } = requireAuth()
  const { slug } = useParams()

  //   const organization = developer.getOrganizationBySlug(slug)

  return (
    <>
      <h1>Onboarding</h1>
    </>
  )
}

export default Organization
