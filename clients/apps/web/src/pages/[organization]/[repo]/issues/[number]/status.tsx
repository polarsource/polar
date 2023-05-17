import { CheckCircleIcon } from '@heroicons/react/24/outline'
import IssueListItem from 'components/Dashboard/IssueListItem'
import GithubLoginButton from 'components/Shared/GithubLoginButton'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import { api } from 'polarkit'
import { Platforms, type PledgeResources } from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import { GrayCard, WhiteCard } from 'polarkit/components/ui/Cards'
import { ReactElement, useEffect, useRef } from 'react'
import { useAuth } from '../../../../../hooks/auth'

const PledgeStatusPage: NextLayoutComponentType = ({
  organization,
  repository,
  issue,
  pledge,
}: PledgeResources) => {
  const { currentUser, reloadUser } = useAuth()
  const didReloadUser = useRef(false)

  useEffect(() => {
    if (currentUser && !didReloadUser.current) {
      didReloadUser.current = true
      // reload user object after successful pledging
      // this us used to grant the user access to polar (alpha/beta) without an invite code
      reloadUser()
    }
  }, [currentUser, reloadUser])

  if (!pledge || !organization || !repository || !issue) {
    return <></>
  }

  return (
    <>
      <div className="mx-auto p-4 md:mt-24 md:w-[768px] md:p-0">
        <div className="flex flex-row items-center">
          <h1 className="w-1/2 text-2xl font-normal text-gray-800">
            <CheckCircleIcon className="inline-block h-10 w-10 text-blue-500" />{' '}
            Thank you!
          </h1>
          <p className="w-1/2 text-right align-middle text-sm font-normal text-gray-600">
            Backed <PolarTimeAgo date={new Date(pledge.created_at)} />
          </p>
        </div>

        <GrayCard className="mt-6">
          <IssueListItem
            issue={issue}
            org={organization}
            repo={repository}
            pledges={[pledge]}
            references={[]}
          />
        </GrayCard>

        {!currentUser && (
          <>
            <WhiteCard className="mt-11 flex flex-row" padding={false}>
              <div className="flex flex-col space-y-5 p-5 md:w-2/5">
                <h2 className="text-lg text-gray-900">Sign up to Polar</h2>
                <GithubLoginButton pledgeId={pledge.id} />

                <ul>
                  <li className="flex flex-row items-center">
                    <svg
                      className="mr-3 h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8.25 6.75H20.25M8.25 12H20.25M8.25 17.25H20.25M3.75 6.75H3.757V6.758H3.75V6.75ZM4.125 6.75C4.125 6.84946 4.08549 6.94484 4.01516 7.01516C3.94484 7.08549 3.84946 7.125 3.75 7.125C3.65054 7.125 3.55516 7.08549 3.48483 7.01516C3.41451 6.94484 3.375 6.84946 3.375 6.75C3.375 6.65054 3.41451 6.55516 3.48483 6.48484C3.55516 6.41451 3.65054 6.375 3.75 6.375C3.84946 6.375 3.94484 6.41451 4.01516 6.48484C4.08549 6.55516 4.125 6.65054 4.125 6.75ZM3.75 12H3.757V12.008H3.75V12ZM4.125 12C4.125 12.0995 4.08549 12.1948 4.01516 12.2652C3.94484 12.3355 3.84946 12.375 3.75 12.375C3.65054 12.375 3.55516 12.3355 3.48483 12.2652C3.41451 12.1948 3.375 12.0995 3.375 12C3.375 11.9005 3.41451 11.8052 3.48483 11.7348C3.55516 11.6645 3.65054 11.625 3.75 11.625C3.84946 11.625 3.94484 11.6645 4.01516 11.7348C4.08549 11.8052 4.125 11.9005 4.125 12ZM3.75 17.25H3.757V17.258H3.75V17.25ZM4.125 17.25C4.125 17.3495 4.08549 17.4448 4.01516 17.5152C3.94484 17.5855 3.84946 17.625 3.75 17.625C3.65054 17.625 3.55516 17.5855 3.48483 17.5152C3.41451 17.4448 3.375 17.3495 3.375 17.25C3.375 17.1505 3.41451 17.0552 3.48483 16.9848C3.55516 16.9145 3.65054 16.875 3.75 16.875C3.84946 16.875 3.94484 16.9145 4.01516 16.9848C4.08549 17.0552 4.125 17.1505 4.125 17.25Z"
                        stroke="#9A6AFF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div>
                      <strong className="text-sm font-medium text-gray-900">
                        Overview
                      </strong>
                      <p className="text-sm font-normal text-gray-500">
                        Lorem ipsum dolar sit amet
                      </p>
                    </div>
                  </li>

                  <li className="mt-5 flex flex-row items-center">
                    <svg
                      className="mr-3 h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21.0008 20.9998L15.8038 15.8028M15.8038 15.8028C17.2104 14.3962 18.0006 12.4885 18.0006 10.4993C18.0006 8.51011 17.2104 6.60238 15.8038 5.19581C14.3972 3.78923 12.4895 2.99902 10.5003 2.99902C8.51108 2.99902 6.60336 3.78923 5.19678 5.19581C3.79021 6.60238 3 8.51011 3 10.4993C3 12.4885 3.79021 14.3962 5.19678 15.8028C6.60336 17.2094 8.51108 17.9996 10.5003 17.9996C12.4895 17.9996 14.3972 17.2094 15.8038 15.8028Z"
                        stroke="#9A6AFF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div>
                      <strong className="text-sm font-medium text-gray-900">
                        Track
                      </strong>
                      <p className="text-sm font-normal text-gray-500">
                        Lorem ipsum dolar sit amet
                      </p>
                    </div>
                  </li>

                  <li className="mt-5 flex flex-row items-center">
                    <svg
                      className="mr-3 h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 6V18M9 15.182L9.879 15.841C11.05 16.72 12.949 16.72 14.121 15.841C15.293 14.962 15.293 13.538 14.121 12.659C13.536 12.219 12.768 12 12 12C11.275 12 10.55 11.78 9.997 11.341C8.891 10.462 8.891 9.038 9.997 8.159C11.103 7.28 12.897 7.28 14.003 8.159L14.418 8.489M21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12Z"
                        stroke="#9A6AFF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div>
                      <strong className="text-sm font-medium text-gray-900">
                        Back
                      </strong>
                      <p className="text-sm font-normal text-gray-500">
                        Lorem ipsum dolar sit amet
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="hidden w-3/5  border-l border-gray-200 bg-gray-50 md:block"></div>
            </WhiteCard>
          </>
        )}
      </div>
    </>
  )
}

PledgeStatusPage.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (
    typeof context?.params?.organization !== 'string' ||
    typeof context?.params?.repo !== 'string' ||
    typeof context?.params?.number !== 'string' ||
    typeof context?.query?.pledge_id !== 'string'
  ) {
    return { props: {} }
  }

  const res = await api.pledges.getPledgeWithResources({
    platform: Platforms.GITHUB,
    orgName: context.params.organization,
    repoName: context.params.repo,
    number: parseInt(context.params.number),
    pledgeId: context.query.pledge_id,
    include: 'issue,organization,repository',
  })

  const { organization, repository, issue, pledge } = res
  return {
    props: { organization, repository, issue, pledge, query: context.query },
  }
}

export default PledgeStatusPage
