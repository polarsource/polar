import { PolarAPI } from './client'
import { getServerURL } from '../utils'
import { QueryClient } from '@tanstack/react-query'
export {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'

export const queryClient = new QueryClient()

export const api = new PolarAPI({
  BASE: getServerURL(),
  WITH_CREDENTIALS: true,
})
