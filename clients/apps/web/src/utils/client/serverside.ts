import { Client } from '@polar-sh/client'
import {
  cookies,
  headers,
  type UnsafeUnwrappedCookies,
  type UnsafeUnwrappedHeaders,
} from 'next/headers'
import { cache } from 'react'
import { createServerSideAPI } from '.'

const _getServerSideAPI = async (token?: string): Promise<Client> => {
  return createServerSideAPI(
    headers() as unknown as UnsafeUnwrappedHeaders,
    cookies() as unknown as UnsafeUnwrappedCookies,
    token,
  )
}

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
