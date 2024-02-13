import { getServerSideAPI } from '@/utils/api'

export default async function Home() {
  console.log()
  const polar = getServerSideAPI(process.env.POLAR_API_KEY)

  console.log(await polar.articles.list())

  return <main></main>
}
