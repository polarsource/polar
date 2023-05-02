import { type MouseEvent } from 'react'

export const OnboardingControls = ({
  onClickContinue,
  skippable = false,
  onClickSkip = () => {},
}: {
  onClickContinue: () => void
  skippable?: boolean
  onClickSkip?: () => void
}) => {
  const clickedContinue = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onClickContinue()
  }

  const clickedSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (skippable && onClickSkip) {
      onClickSkip()
    }
  }

  return (
    <>
      <div className="mt-10 flex flex-col justify-center">
        <button
          className="m-auto w-32 rounded-xl bg-blue-600 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-500"
          onClick={clickedContinue}
        >
          Continue
        </button>
        {skippable && (
          <a
            href="#"
            className="mt-2 text-center font-medium text-blue-600 hover:underline hover:underline-offset-2"
            onClick={clickedSkip}
          >
            Skip
          </a>
        )}
      </div>
    </>
  )
}

export default OnboardingControls
