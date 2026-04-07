import { useSession } from '@/providers/SessionProvider'
import { schemas } from '@polar-sh/client'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

export const useDeleteUser = (): UseMutationResult<
  { data?: schemas['UserDeletionResponse']; error?: { detail: string } },
  Error,
  void
> => {
  const { session } = useSession()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/users/me`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )

      if (!response.ok) {
        const error = await response.json()
        return { error }
      }

      const data = await response.json()
      return { data }
    },
  })
}
