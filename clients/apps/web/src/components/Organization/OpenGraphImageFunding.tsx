import { Issue } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'

const OpenGraphImageFunding = (props: {
  org_name: string
  repo_name?: string
  issue_count: number
  avatar: string
  issues: Issue[]
  largeIssue: boolean
}) => {
  const issueCount = props.largeIssue ? 1 : 2

  const showIssues = props.issues.slice(0, issueCount).map((i) => {
    const now = new Date()
    const createdAt = new Date(i.issue_created_at)
    const days = Math.floor(
      (now.getTime() - createdAt.getTime()) / 1000 / 60 / 60 / 24,
    )
    return {
      ...i,
      opened_since:
        days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} ago` : 'today',
    }
  })

  const imageBaseURL = 'https://polar.sh/'

  let h1 = ''
  if (props.largeIssue) {
    h1 = 'seeks backing for'
  } else if (props.issue_count > 0) {
    h1 = `seeks backing for ${props.issue_count} ${
      props.issue_count === 1 ? 'issue' : 'issues'
    }`
  } else {
    h1 = 'seeks backing'
  }

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
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '50px',
            height: '100%',
            width: '100%',
            gap: '50px',
          }}
        >
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
              src={props.avatar}
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
                // TODO: figure out a way to enable ellipsis without truncating shorter words
                // textOverflow: 'ellipsis',
              }}
            >
              {props.org_name}
            </div>
            <div
              style={{
                flexShrink: 0,
              }}
            >
              {h1}
            </div>
          </div>

          {showIssues.map((i) => (
            <div
              key={i.id}
              style={{
                background: 'white',
                width: '1080px',
                height: props.largeIssue ? '300px' : '131px',
                display: 'flex',
                borderRadius: '24px',
                flexDirection: props.largeIssue ? 'column' : 'row',
                padding: '25px 38px',
                boxShadow:
                  '0px 1px 8px rgba(0, 0, 0, 0.07), 0px 0.5px 2.5px rgba(0, 0, 0, 0.16)',
                justifyContent: 'space-between',
                gap: props.largeIssue ? '' : '40px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    fontSize: '30px',
                    color: '#181A1F',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {i.title}
                </div>
                <div
                  style={{
                    fontSize: '26px',
                    color: '#727374',
                  }}
                >
                  {`#${i.number} opened ${i.opened_since}`}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  flexShrink: 0,
                }}
              >
                {i.funding.funding_goal ? (
                  <div>
                    <div
                      style={{
                        color: '#181A1F',
                        fontSize: '24px',
                        lineHeight: '36px',
                      }}
                    >
                      $
                      {getCentsInDollarString(
                        i.funding.pledges_sum?.amount || 0,
                        false,
                        true,
                      )}{' '}
                      <span style={{ color: '#999999' }}>
                        {`/ $${getCentsInDollarString(
                          i.funding.funding_goal.amount,
                          false,
                          true,
                        )} funded`}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            ((i.funding.pledges_sum?.amount ?? 0) /
                              i.funding.funding_goal.amount) *
                            100
                          }%`,
                          background: '#0062FF',
                          height: '12px',
                        }}
                      ></div>
                      <div
                        style={{
                          background: '#E5E5E1',
                          flexGrow: 1,
                          height: '12px',
                        }}
                      ></div>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: props.largeIssue
                      ? 'space-between'
                      : 'center',
                    alignItems: 'center',
                    fontSize: '24px',
                    lineHeight: '36px',
                    gap: '20px',
                    color: '#808080',
                    flexShrink: 0,
                  }}
                >
                  {i.reactions && i.reactions.plus_one > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                      }}
                    >
                      <img
                        style={{
                          height: '36px',
                        }}
                        src={imageBaseURL + '/og_thumbs_up.png'}
                      />
                      <div
                        style={{
                          marginLeft: '12px',
                          verticalAlign: 'center',
                        }}
                      >{`${i.reactions.plus_one}`}</div>
                    </div>
                  ) : (
                    <div></div>
                  )}
                  <div
                    style={{
                      background: '#0062FF',
                      color: 'white',
                      fontSize: '24px',
                      padding: '14px 28px',
                      borderRadius: '12px',
                      lineHeight: '24px',
                    }}
                  >
                    Pledge
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!props.largeIssue && (
          <div
            style={{
              background:
                'linear-gradient(180deg, rgba(254, 253, 249, 0) 0%, #FEFDF9 56.95%)',
              height: '300px',
              width: '100%',
              position: 'absolute',
              top: '305px',
            }}
          ></div>
        )}

        <img
          height={50}
          width={142}
          style={{
            position: 'absolute',
            bottom: '50px',
          }}
          src={imageBaseURL + '/og_logotype.png'}
        />
      </div>
    </div>
  )
}

export default OpenGraphImageFunding
