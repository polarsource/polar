import { PolarAPI } from '@polar-sh/sdk'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { buildServerSideAPI } from '.'

const _getServerSideAPI = (): PolarAPI => {
  return buildServerSideAPI(headers(), cookies())
}

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
