import { QueryClient } from '@tanstack/react-query'
import { getServerURL } from '../utils'
import { CancelablePromise, PolarAPI } from './client'
export {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
export { CancelablePromise }

export const queryClient = new QueryClient()

export const api = new PolarAPI({
  BASE: getServerURL(),
  WITH_CREDENTIALS: true,
})
