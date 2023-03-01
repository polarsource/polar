import { requireAuth } from 'polarkit/hooks'
import { useParams } from 'react-router-dom'
import { api } from 'polarkit'

const Onboarding = () => {
  const { currentUser } = requireAuth()
  const { orgSlug } = useParams()

  return (
    <>
      <h1>Onboarding</h1>
      <p>Let's create some magic: {orgSlug}</p>
    </>
  )
}

export default Onboarding
