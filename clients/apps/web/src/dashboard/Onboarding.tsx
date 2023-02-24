import { requireAuth } from 'polarkit/context/auth'
import { useParams } from 'react-router-dom'
import { api } from 'polarkit'

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
