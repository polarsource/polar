import { Article, Organization } from '@polar-sh/sdk'
import { LogoIcon } from 'polarkit/components/brand'
import Avatar from 'polarkit/components/ui/atoms/avatar'

export const Posts = ({
  organization,
  posts,
  darkmode,
}: {
  organization: Organization
  posts: Article[]
  darkmode: boolean
}) => {
  return (
    <div
      style={{
        display: 'flex',
        color: darkmode ? '#D2D4DF' : '#181a1f',
        backgroundColor: darkmode ? '#101116' /*gray-700*/ : '#FDFDFF',
        border: darkmode ? '1px solid #1D1E27' : '1px solid #F3F4F7',
        width: '480px',
        borderRadius: '24px',
        overflow: 'hidden',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        style={{
          padding: '20px 20px',
          border: darkmode ? '1px solid #1D1E27' : '1px solid #F3F4F7',
          backgroundColor: darkmode ? '#101116' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <Avatar
              width={36}
              height={36}
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
          </div>
          <div
            style={{
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              fontWeight: 600,
            }}
          >
            {organization.name}
          </div>
        </div>
        <div
          style={{
            background: '#0062FF',
            color: 'white',
            borderRadius: 99,
            height: '32px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '15px',
            fontWeight: '500',
            padding: '0 12px 0 8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: '0',
              gap: '6px',
            }}
          >
            <LogoIcon size={24} />
            <div
              style={{
                display: 'flex',
                flexShrink: '0',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Read on Polar
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '32px 20px',
        }}
      >
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              display: 'flex',
              fontSize: '16px',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontWeight: '600',
                display: 'flex',
                width: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                padding: '0 10px 0 0 ',
              }}
            >
              {post.title}
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
              <div
                style={{
                  color: darkmode ? '#636989' : '#5F6C81',
                  display: 'flex',
                  fontSize: 14,
                }}
              >
                {new Date(post.published_at ?? 0).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              {post.is_pinned ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 10,
                    background: darkmode ? '#00245E' : '#E5EFFF',
                    color: '#66A1FF',
                  }}
                >
                  Pinned
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
