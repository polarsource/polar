import { getQueryClient } from '@/utils/api/query'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onEventIngested = async (_payload: unknown) => {
  const queryClient = getQueryClient()
  await queryClient.invalidateQueries({ queryKey: ['events'] })
  await queryClient.invalidateQueries({ queryKey: ['eventNames'] })
}
