import { useAdvertisementDisplays } from 'polarkit/hooks'

const BrowserAd = (props: { subscriptionBenefitId: string }) => {
  const display = useAdvertisementDisplays(props.subscriptionBenefitId)

  if (typeof props.subscriptionBenefitId !== 'string') {
    return <div className="bg-gray-200 p-2 text-red-800">Invalid Ad</div>
  }

  if (
    !display.data ||
    !display.data.items ||
    display.data.items?.length === 0
  ) {
    // No ad found
    return <></>
  }

  const idx = Math.floor(Math.random() * display.data.items.length)
  const ad = display.data.items[idx]

  return (
    <>
      <div className="not-prose flex flex-col items-center space-y-2 bg-gray-100 px-2 py-2 dark:bg-gray-900">
        <span className="font-mono text-xs">Thanks to our sponsor</span>
        <a href={ad.link_url}>
          <picture>
            {ad.image_url_dark ? (
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/embed/ad?id=${ad.id}&dark=1`}
              />
            ) : null}
            <img src={`/embed/ad?id=${ad.id}`} alt={ad.text} />
          </picture>
        </a>
      </div>
    </>
  )
}

export default BrowserAd
