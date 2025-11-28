import { useSession } from '@/providers/SessionProvider'
import { useQuery } from '@tanstack/react-query'
import { createContext, PropsWithChildren, useContext } from 'react'

export interface User {
  sub: string
  email: string
  name?: string
  picture?: string
}

interface UserContextValue {
  user: User | undefined
  isLoading: boolean
}

const UserContext = createContext<UserContextValue>({
  user: undefined,
  isLoading: true,
})

export const useUser = () => useContext(UserContext)

export function UserProvider({ children }: PropsWithChildren) {
  const { session } = useSession()

  const { data: user, isLoading } = useQuery({
    queryKey: ['userinfo'],
    queryFn: async (): Promise<User> => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/userinfo`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error('Failed to fetch user info')
      }

      return response.json()
    },
    enabled: !!session,
  })

  return (
    <UserContext.Provider value={{ user, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}
