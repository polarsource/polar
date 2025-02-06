import { Client } from '@polar-sh/client'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { createServerSideAPI } from '.'

const _getServerSideAPI = (token?: string): Client => {
  return createServerSideAPI(headers(), cookies(), token)
}

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
