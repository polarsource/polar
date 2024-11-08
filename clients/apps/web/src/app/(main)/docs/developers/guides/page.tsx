'use server'
import { redirect } from 'next/navigation'

// We redirect /guides/:path so this is a hack to redirect the root /guides
// However, we likely want to add an index for guides in the near-term as they
// grow vs. promote them all on /developers
export default async function Page() {
  redirect('/docs/developers')
}
