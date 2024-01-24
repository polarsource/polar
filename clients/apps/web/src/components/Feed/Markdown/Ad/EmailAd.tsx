import { BenefitAds } from '../markdown'

const EmailAd = (props: {
  subscriptionBenefitId: string
  adsContext?: BenefitAds[]
}) => {
  if (typeof props.subscriptionBenefitId !== 'string') {
    return <div className="bg-gray-200 p-2 text-red-800">Invalid Ad</div>
  }

  if (!props.adsContext) {
    return <></>
  }

  const data = props.adsContext.find(
    (c) => c.benefitId === props.subscriptionBenefitId,
  )

  if (!data || !data.ads || data.ads.length === 0) {
    // No ad found
    return <></>
  }

  const idx = Math.floor(Math.random() * data.ads.length)
  const ad = data.ads[idx]

  return (
    <>
      <div className="not-prose flex flex-col items-center space-y-2 bg-gray-100 px-2 py-2">
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

export const parseBenefitIdsFromBody = (body: string): string[] => {
  const searchString = '<Ad subscriptionBenefitId='

  let offset = 0
  let res = []

  while (offset < body.length) {
    const idx = body.indexOf(searchString, offset)

    if (idx < 0) {
      break
    }

    const start = idx + searchString.length + 1
    const end = start + 36

    const id = body.substring(start, end)
    res.push(id)

    offset = end
  }

  return res
}

export default EmailAd
