import GetStartedButton from '../Auth/GetStartedButton'

export const Upsell = () => {
  return (
    <div className="flex flex-col items-center gap-y-12 text-center">
      <h1 className="font-display text-7xl leading-tight!">
        Modern billing.
        <br />
        Built for the AI era.
      </h1>
      <GetStartedButton />
    </div>
  )
}
