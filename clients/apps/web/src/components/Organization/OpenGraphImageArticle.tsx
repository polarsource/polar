import { Article } from '@polar-sh/sdk'

const OpenGraphImageArticle = (props: { article: Article }) => {
  const { article } = props

  return (
    <div
      style={{
        height: 630,
        width: 1200,
        display: 'flex',
        background: 'white',
      }}
    >
      <div
        style={{
          height: 630,
          width: 1200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background:
            'linear-gradient(140.12deg, rgba(252, 240, 236, 0.8) 6.39%, rgba(254, 253, 249, 0.8) 61.9%)',
          overflow: 'hidden',
          gap: '50px',
          padding: '50px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            fontSize: '42px',

            color: '#181A1F',
            width: '100%',
            minWidth: '100%',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              whiteSpace: 'pre-wrap',
              maxWidth: '100%',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {article.title}
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              color: '#727374',
            }}
          >
            by
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px',
              fontSize: '42px',
              color: '#727374',
              width: '100%',
              minWidth: '100%',
              justifyContent: 'center',
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
                fontWeight: 'bold',
                color: '#181A1F',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {article.byline.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpenGraphImageArticle
