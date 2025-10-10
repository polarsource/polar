'use client'

const TooManyRequests = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-y-16 px-12">
      <h1 className="text-4xl font-semibold text-black dark:text-white">429</h1>
      <h1 className="dark:text-polar-600 max-w-md text-center text-2xl leading-normal text-gray-700">
        You have been rate limited.
        <br />
        Please try again in 15 minutes.
      </h1>
    </div>
  )
}

export default TooManyRequests
