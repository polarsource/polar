import GetStartedButton from '../Auth/GetStartedButton'

export const Upsell = () => {
  return (
    <div className="flex flex-col items-center gap-y-12 py-24 text-center">
      <h1 className="font-display text-4xl leading-tight! xl:text-7xl">
        Modern billing.
        <br />
        Built for the AI era.
      </h1>
      <GetStartedButton />
    </div>
  )
}
