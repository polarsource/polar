import { Client } from '@polar-sh/client'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { createServerSideAPI } from '.'

const _getServerSideAPI = async (token?: string): Promise<Client> => {
  return createServerSideAPI(await headers(), await cookies(), token)
}

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
