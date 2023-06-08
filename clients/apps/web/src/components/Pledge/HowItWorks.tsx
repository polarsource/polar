import { CurrencyDollarIcon } from '@heroicons/react/24/outline'
import type { NextLayoutComponentType } from 'next'

const HowItWorks: NextLayoutComponentType = () => {
  const arrow = (
    <svg
      width="33"
      height="15"
      viewBox="0 0 33 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32.3536 7.19324C32.5488 7.3885 32.5488 7.70509 32.3536 7.90035L25.7071 14.5467C25.5118 14.742 25.1953 14.742 25 14.5467C24.8047 14.3514 24.8047 14.0349 25 13.8396L30.7929 8.0468L-6.68519e-07 8.04687L-5.81096e-07 7.04687L30.7929 7.0468L25 1.25346C24.8047 1.0582 24.8047 0.741614 25 0.546352C25.1953 0.351089 25.5118 0.351089 25.7071 0.546351L32.3536 7.19324Z"
        className="fill-blue-200 dark:fill-blue-500/40"
      />
    </svg>
  )

  return (
    <>
      <div className="mb-20 text-left">
        <ul className="mt-2 flex flex-col items-center justify-center space-y-5 p-5 md:mt-6 md:flex-row md:space-y-0 md:space-x-4 md:p-0">
          <li className="flex w-full flex-col rounded-xl bg-white p-4 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700 md:w-auto">
            <div className="flex flex-row items-center space-x-1 text-blue-600 dark:text-blue-500">
              <CurrencyDollarIcon width={24} height={24} />
              <strong className="text-sm font-medium">Back</strong>
            </div>
            <p className="mt-1.5 text-sm font-normal text-gray-600 dark:text-gray-400">
              Prioritize and support impactful efforts.
            </p>
          </li>
          <div className="scale-y w-8 rotate-90 md:rotate-0">{arrow}</div>
          <li className="flex w-full flex-col rounded-xl bg-white p-4 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700 md:w-auto">
            <div className="flex flex-row items-center space-x-1 text-blue-600 dark:text-blue-500">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_2473_71700)">
                  <path
                    d="M9.99935 18.3332C14.6017 18.3332 18.3327 14.6022 18.3327 9.99984C18.3327 5.39746 14.6017 1.6665 9.99935 1.6665C5.39698 1.6665 1.66602 5.39746 1.66602 9.99984C1.66602 14.6022 5.39698 18.3332 9.99935 18.3332Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.3333 10H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4.99935 10H1.66602"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 4.99984V1.6665"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 18.3333V15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_2473_71700">
                    <rect width="20" height="20" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <strong className="text-sm font-medium">Track</strong>
            </div>
            <p className="mt-1.5 text-sm font-normal text-gray-600 dark:text-gray-400">
              Get progress updates without having to dive into the nitty-gritty.
            </p>
          </li>
          <div className="w-8 rotate-90 md:rotate-0">{arrow}</div>
          <li className="flex w-full flex-col rounded-xl bg-white p-4 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700 md:w-auto">
            <div className="flex flex-row items-center space-x-1 text-blue-600 dark:text-blue-500">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.99935 12.5002C13.221 12.5002 15.8327 9.88849 15.8327 6.66683C15.8327 3.44517 13.221 0.833496 9.99935 0.833496C6.77769 0.833496 4.16602 3.44517 4.16602 6.66683C4.16602 9.88849 6.77769 12.5002 9.99935 12.5002Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.84232 11.5752L5.83398 19.1669L10.0007 16.6669L14.1673 19.1669L13.159 11.5669"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <strong className="text-sm font-medium">Reward</strong>
            </div>
            <p className="mt-1.5 text-sm font-normal text-gray-600 dark:text-gray-400">
              Upon successful merge funds are rewarded.
            </p>
          </li>
        </ul>
      </div>
    </>
  )
}

export default HowItWorks
