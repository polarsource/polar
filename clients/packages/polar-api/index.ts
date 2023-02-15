import { PolarAPI } from './client'

const options = {
  BASE: '',
  WITH_CREDENTIALS: true,
}

if (process?.env?.NEXT_PUBLIC_API_URL) {
  options.BASE = process.env.NEXT_PUBLIC_API_URL
}

export const client = new PolarAPI(options)
