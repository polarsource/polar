import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { requireAuth } from 'polarkit/hooks'

const Home: NextPage = () => {
  const { currentUser } = requireAuth()
  const router = useRouter()

  if (currentUser) {
    router.push('/dashboard')
    return
  }

  return <></>
}

export default Home
