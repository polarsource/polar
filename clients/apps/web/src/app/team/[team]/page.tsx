import { Metadata, ResolvingMetadata } from 'next'
import { redirect } from 'next/navigation'

export async function generateMetadata(
  {
    params,
  }: {
    params: { team: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `${params.team}`, // " | Polar is added by the template"
  }
}

export default function Page({ params }: { params: { team: string } }) {
  return redirect(`/team/${params.team}/funding`)
}
