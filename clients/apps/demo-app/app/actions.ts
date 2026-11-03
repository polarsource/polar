'use server'

import { createHash } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import {
  callTool,
  createProCheckout,
  ensureFreePlan,
  grantSurveyCredits,
  isPro,
  polar,
  purchaseTopUp,
  type TopUp,
} from '../polar'
import { readOutpost } from '../outpost'

const COOKIE = 'external_customer_id'

export const getExternalCustomerId = async () =>
  (await cookies()).get(COOKIE)?.value

export async function login(formData: FormData) {
  const rawEmail = formData.get('email')
  if (typeof rawEmail !== 'string') throw new Error('Missing email')
  const email = rawEmail.trim().toLowerCase()
  const externalId = createHash('sha256').update(email).digest('hex')

  await ensureFreePlan(email, externalId)
  ;(await cookies()).set(COOKIE, externalId)
  redirect('/')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  redirect('/')
}

const CALL_COUNTS = [1, 10, 100]

export async function call(server: 'builtin' | 'custom', count: number) {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')
  if (!CALL_COUNTS.includes(count)) throw new Error(`Invalid count ${count}`)

  const result = await callTool(externalId, server, count)
  after(() => polar.flush())
  return result
}

export async function getBalance() {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  const start = performance.now()
  const { balance } = await polar
    .actor({ externalCustomerId: externalId })
    .balance('tool_call')
  const readMs = performance.now() - start

  return { balance, readMs, outpost: await readOutpost(externalId) }
}

export async function getOutpost() {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  return readOutpost(externalId)
}

export async function upgrade() {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  const origin = `http://${(await headers()).get('host')}`
  redirect(await createProCheckout(externalId, origin))
}

export async function checkUpgraded() {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  return isPro(externalId)
}

export async function claimSurveyCredits(answer: string) {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')
  if (typeof answer !== 'string' || answer.trim() === '') {
    throw new Error('Missing survey answer')
  }

  await grantSurveyCredits(externalId, answer.trim().slice(0, 1000))
}

export async function topUp(pack: TopUp) {
  const externalId = await getExternalCustomerId()
  if (!externalId) redirect('/')

  return purchaseTopUp(externalId, pack)
}
