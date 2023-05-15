import PageNotFound from 'components/Shared/PageNotFound'
import Pledge from 'components/Website/Pledge'
import type {
  GetServerSideProps,
  NextLayoutComponentType,
  NextPage,
} from 'next'
import Head from 'next/head'
import { api } from 'polarkit'
import { Platforms, PledgeResources } from 'polarkit/api/client'

const HowItWorks: NextLayoutComponentType = () => {
  return (
    <>
      <div className="text-center">
        <h4 className="text-lg font-normal text-gray-600">How does it work?</h4>
        <ul className="mt-8 flex flex-col items-center justify-center space-y-8 md:flex-row md:space-y-0 md:space-x-16">
          <li className="flex w-56 flex-col text-center">
            <div className="mx-auto w-7 rounded-full border-2 border-blue-800">
              <span className="text-sm font-bold text-blue-800">1</span>
            </div>
            <strong className="mt-4 text-sm font-medium text-gray-900">
              Back
            </strong>
            <p className="mt-1.5 text-xs font-normal text-gray-600">
              Prioritize and support impactful efforts.
            </p>
          </li>
          <li className="flex w-56 flex-col text-center">
            <div className="mx-auto w-7 rounded-full border-2 border-blue-800">
              <span className="text-sm font-bold text-blue-800">2</span>
            </div>
            <strong className="mt-4 text-sm font-medium text-gray-900">
              Track
            </strong>
            <p className="mt-1.5 text-xs font-normal text-gray-600">
              Get progress updates without having to dive into the nitty-gritty.
            </p>
          </li>
          <li className="flex w-56 flex-col text-center">
            <div className="mx-auto w-7 rounded-full border-2 border-blue-800">
              <span className="text-sm font-bold text-blue-800">3</span>
            </div>
            <strong className="mt-4 text-sm font-medium text-gray-900">
              Reward
            </strong>
            <p className="mt-1.5 text-xs font-normal text-gray-600">
              Upon successful merge funds are rewarded.
            </p>
          </li>
        </ul>
      </div>
    </>
  )
}

const PledgePage: NextPage = ({
  organization,
  repository,
  issue,
}: PledgeResources) => {
  if (!issue) {
    return <PageNotFound />
  }
  if (!organization || !repository) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar | {issue.title}</title>
      </Head>
      <div className="mx-auto mt-24 md:w-[826px]">
        <h1 className="text-center text-4xl font-normal text-gray-800">
          Complete your backing
        </h1>

        <Pledge
          organization={organization}
          repository={repository}
          issue={issue}
        />

        <HowItWorks />
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    if (
      typeof context?.params?.organization !== 'string' ||
      typeof context?.params?.repo !== 'string' ||
      typeof context?.params?.number !== 'string'
    ) {
      return { props: {} }
    }

    const res = await api.pledges.getPledgeWithResources({
      platform: Platforms.GITHUB,
      orgName: context.params.organization,
      repoName: context.params.repo,
      number: parseInt(context.params.number),
      include: 'issue,organization,repository',
    })
    const { organization, repository, issue } = res
    return { props: { organization, repository, issue, query: context.query } }
  } catch (Error) {
    return { props: {} }
  }
}

export default PledgePage
