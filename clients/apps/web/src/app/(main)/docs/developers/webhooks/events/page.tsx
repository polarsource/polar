'use server'
import { redirect } from 'next/navigation'

export default async function Page() {
  redirect('/docs/developers/webhooks')
}
