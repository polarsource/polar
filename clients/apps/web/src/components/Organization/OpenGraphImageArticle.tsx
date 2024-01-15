import { Article } from '@polar-sh/sdk'
import { LogoIcon } from 'polarkit/components/brand'

const generatePostOGFallbackPath = (slug: string, maxInt: number) => {
  let sum = 0
  for (let i = 0; i < slug.length; i++) {
    sum += slug.charCodeAt(i)
  }
  return `${sum % maxInt}.jpg`
}

const imageBaseURL = 'https://polar.sh/assets/posts/og'

const OpenGraphImageArticle = (props: { article: Article }) => {
  const { article } = props

  return (
    <div
      style={{
        position: 'relative',
        height: 630,
        width: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'white',
        backgroundImage: `url(${imageBaseURL}/${generatePostOGFallbackPath(
          article.slug,
          7,
        )})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
        padding: '92px 64px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          fontSize: '32px',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {article.byline.name}
        </div>
      </div>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'pre-wrap',
          fontWeight: 600,
          fontSize: '48px',
          textAlign: 'center',
          /** @ts-ignore */
          textWrap: 'balance',
        }}
      >
        {article.title}
      </span>
      <LogoIcon size={72} />
    </div>
  )
}

export default OpenGraphImageArticle
