import { HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const server = setupServer()

export const API_URL = process.env.NEXT_PUBLIC_API_URL as string

export const apiError = (status: number, error: string, detail = error) =>
  HttpResponse.json({ error, detail }, { status })
