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
      <div className="dark:border-polar-700 border-t border-gray-200 pb-8 pt-16">
        <h3 className="dark:text-polar-200 pb-6 text-center font-medium text-gray-900">
          How does funding with Polar work?
        </h3>
        <div className="mt-4 grid md:grid-cols-3 md:gap-14 md:px-14">
          {steps.map((s) => (
            <div
              key={`step-${s.number}`}
              className="flex flex-col items-center space-y-4 p-2"
            >
              <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-500 text-blue-500">
                {s.number}
              </div>
              <p className="dark:text-polar-400 text-center text-gray-900">
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
