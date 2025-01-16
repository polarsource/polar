import { PolarAPI } from '@polar-sh/api'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { buildServerSideAPI } from '.'

const _getServerSideAPI = (token?: string): PolarAPI => {
  return buildServerSideAPI(headers(), cookies(), token)
}

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
