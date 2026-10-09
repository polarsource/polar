'use server'

import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { callTool, ensureFreePlan, polar } from '../polar'

const COOKIE = 'external_customer_id'

export const getExternalCustomerId = async () =>
  (await cookies()).get(COOKIE)?.value

export async function login(formData: FormData) {
  const email = String(formData.get('email')).trim().toLowerCase()
  const externalId = createHash('sha256').update(email).digest('hex')

  await ensureFreePlan(email, externalId)
  ;(await cookies()).set(COOKIE, externalId)
  redirect('/')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  redirect('/')
}

export async function call(server: 'builtin' | 'custom') {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  return callTool(externalId, server)
}

export async function getBalance() {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  return polar.actor({ externalCustomerId: externalId }).balance('tool_call')
}
