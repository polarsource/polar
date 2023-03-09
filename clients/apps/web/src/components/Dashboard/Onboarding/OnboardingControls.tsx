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
      <div className="flex flex-col justify-center">
        <button
          className="m-auto w-32 rounded-lg bg-purple-500 p-2 text-center text-white"
          onClick={clickedContinue}
        >
          Continue
        </button>
        {skippable && (
          <a
            href="#"
            className="mt-2 text-center font-medium text-purple-600"
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
