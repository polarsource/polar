import { PolarAPI } from "polar-api/client"


export const client = new PolarAPI({
  BASE: process.env.NEXT_PUBLIC_API_URL,
  WITH_CREDENTIALS: true
})