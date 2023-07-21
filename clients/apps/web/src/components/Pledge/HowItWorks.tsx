import type { NextLayoutComponentType } from 'next'

const HowItWorks: NextLayoutComponentType = () => {
  const steps = [
    {
      number: 1,
      text: 'Pay now to fund the work behind this issue.',
    },
    {
      number: 2,
      text: 'Get updates on progress being made.',
    },
    {
      number: 3,
      text: 'Maintainer is rewarded once the issue is completed.',
    },
  ]

  return (
    <>
      <div>
        <h3 className="text-center font-medium text-gray-900 dark:text-gray-400">
          How does funding with Polar work?
        </h3>
        <div className="mt-4 grid md:grid-cols-3 md:gap-14 md:px-14">
          {steps.map((s) => (
            <div key={`step-${s.number}`} className="flex flex-col items-center space-y-4 p-2">
              <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-500 text-blue-500">
                {s.number}
              </div>
              <p className="text-center text-gray-900 dark:text-gray-400">
                {' '}
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default HowItWorks
