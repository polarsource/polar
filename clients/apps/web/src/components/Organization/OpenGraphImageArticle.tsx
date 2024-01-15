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
        padding: '64px',
      }}
    >
      <LogoIcon size={72} />
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontSize: '32px',
          gap: '16px',
        }}
      >
        <img
          src={article.byline.avatar_url}
          height={48}
          width={48}
          style={{
            height: 48,
            width: 48,
            borderRadius: 48,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {article.byline.name}
        </div>
      </div>
    </div>
  )
}

export default OpenGraphImageArticle
