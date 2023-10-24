/*
 * Code from Web 1998.
 *
 * We're using inline styles here since this component is also generated as an SVG
 * using @vercel/og or satori directly (TBD) to be embedded on external sites, e.g Github.
 *
 * Vercel is working on experimental support for Tailwind (<3), but...
 *   1) This is a critical component so using an experimental feature is not ideal.
 *   2) Tried it out and 2 components in, some TailwindCSS classes were not being applied.
 *
 * So it's too early for us to use TailwindCSS in this component.
 */

import { Funding } from '@polar-sh/sdk'
import { getCentsInDollarString } from '../../money'

export const Badge = ({
  showAmountRaised = false,
  // amountRaised = undefined,
  darkmode = false,
  funding = undefined,
  avatarsUrls = [],
  upfront_split_to_contributors,
  orgName,
}: {
  showAmountRaised?: boolean
  // amountRaised?: string
  darkmode: boolean
  funding?: Funding
  avatarsUrls: string[]
  upfront_split_to_contributors?: number
  orgName?: string
}) => {
  const showFundingGoal =
    funding &&
    funding.funding_goal &&
    funding.pledges_sum &&
    funding.funding_goal.amount > 0
  const showAmount = !showFundingGoal && showAmountRaised

  const progress =
    showFundingGoal && funding && funding.pledges_sum && funding.funding_goal
      ? Math.max(
          Math.min(
            (funding.pledges_sum.amount / funding.funding_goal.amount) * 100,
            100, // Max 100
          ),
          1, // Min 1
        )
      : 0

  const showAvatars =
    avatarsUrls.length > 4 ? avatarsUrls.slice(0, 3) : avatarsUrls
  const extraAvatarsCount = avatarsUrls.length - showAvatars.length

  const title = showFundingGoal || showAmount ? 'Fund' : 'Fund this issue'

  return (
    <>
      <div
        style={{
          display: 'flex',
          marginBottom: 2,
          maxWidth: '400px',
          flexDirection: 'column',
          borderRadius: 11,
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          border: darkmode
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(0, 0, 0, 0.11)',

          overflow: 'hidden',
          backgroundColor: darkmode ? '#1B1D29' /*gray-700*/ : 'white',
          fontFamily: 'Inter',
          // width: 'fit-content',
        }}
      >
        <div
          style={{
            height: 40,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: darkmode ? '#4667CA' /*blue-500*/ : '#4667CA', // blue-600
                color: 'white',
                padding: 4,
                marginLeft: 6,
                marginRight: 6,
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: '20px',
                paddingLeft: 11,
                paddingRight: 11,
                flexShrink: '0',
              }}
            >
              {title}
            </div>

            {showAmount && funding?.pledges_sum?.amount !== undefined && (
              <div
                style={{
                  display: 'flex',
                  marginRight: 12,
                  marginLeft: 6,
                  flexGrow: 1,
                  fontWeight: 500,
                  fontSize: 13,
                  lineHeight: 20,
                  color: darkmode ? '#D7D9E5' : '#3E3F42', // gray-700
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    opacity: showAmount ? '100' : '0', // To support animations in non-SVG use cases
                    transitionProperty: 'all',
                    transitionDuration: '200ms',
                  }}
                >
                  <span style={{ whiteSpace: 'pre' }}>
                    $
                    {getCentsInDollarString(
                      funding?.pledges_sum?.amount,
                      false,
                      true,
                    )}
                    &nbsp;
                  </span>
                  <span
                    style={{
                      color: darkmode ? '#9499AF' : '#727374',
                      fontWeight: 400,
                    }}
                  >
                    pledged
                  </span>
                </div>
              </div>
            )}

            {showFundingGoal &&
              funding.pledges_sum?.amount !== undefined &&
              funding.funding_goal?.amount !== undefined && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    marginRight: 12,
                    marginLeft: 6,
                    fontSize: 12,
                    flexShrink: '1',
                    gap: '2px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      color: darkmode ? '#9499AF' : '#727374', // gray-500
                      gap: '2px',
                      flexShrink: '0',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 'medium',
                        color: darkmode ? '#D7D9E5' : '#3E3F42', // gray-700
                        flexShrink: '0',
                      }}
                    >
                      $
                      {getCentsInDollarString(
                        funding.pledges_sum.amount,
                        false,
                        true,
                      )}
                      &nbsp;
                    </span>
                    <span
                      style={{
                        flexShrink: '0',
                      }}
                    >
                      / $
                      {getCentsInDollarString(
                        funding.funding_goal.amount,
                        false,
                        true,
                      )}{' '}
                      pledged
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '4px',
                        backgroundColor: '#4667CA', // blue-600

                        transitionProperty: 'all',
                        transitionDuration: '200ms',
                      }}
                    ></div>
                    <div
                      style={{
                        flexGrow: '1',
                        height: '4px',
                        backgroundColor: '#E5E5E1', // gray-200
                      }}
                    ></div>
                  </div>
                </div>
              )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyItems: 'end',
            }}
          >
            {showAvatars.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  height: '22px',
                  flexWrap: 'wrap',
                }}
              >
                {showAvatars.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    style={{
                      height: 22,
                      width: 22,
                      borderRadius: 22,
                      border: darkmode
                        ? '1px solid #1B1D29'
                        : '1px solid white',
                      marginLeft: idx > 0 ? '-6px' : '',
                      flexShrink: '0',
                    }}
                  />
                ))}

                {extraAvatarsCount > 0 && (
                  <div
                    style={{
                      backgroundColor: darkmode ? '#2e4070' : '#C9DBF4',
                      color: darkmode ? '#a6c7ea' : '#4667CA',
                      height: 22,
                      width: 22,
                      borderRadius: 22,
                      marginLeft: '-6px',
                      textAlign: 'center',
                      fontSize: '8px',
                      lineHeight: '20px',
                      border: darkmode
                        ? '1px solid #13151D'
                        : '1px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-around',
                      flexShrink: '0',
                    }}
                  >
                    <span>+{extraAvatarsCount}</span>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                backgroundColor: darkmode ? '#343748' /*polar-600*/ : '#FDFDFC', // gray-50
                height: 40,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 12,
                paddingRight: 12,
                borderLeft: darkmode ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                flexShrink: '0',
              }}
            >
              <svg
                width="58"
                height="17"
                viewBox="0 0 58 17"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.432 13.5423V2.73291H26.7403C27.3065 2.73291 27.8212 2.87704 28.2845 3.16529C28.7478 3.44325 29.1132 3.8293 29.3809 4.32344C29.6588 4.81759 29.7978 5.36835 29.7978 5.97574C29.7978 6.60372 29.6588 7.16992 29.3809 7.67436C29.1132 8.1788 28.7478 8.5803 28.2845 8.87884C27.8212 9.17739 27.3065 9.32666 26.7403 9.32666H23.7754V13.5423H22.432ZM23.7754 8.01409H26.7712C27.08 8.01409 27.358 7.92658 27.6051 7.75157C27.8521 7.56627 28.0477 7.3192 28.1919 7.01036C28.336 6.70152 28.408 6.35664 28.408 5.97574C28.408 5.60513 28.336 5.2757 28.1919 4.98745C28.0477 4.6992 27.8521 4.46757 27.6051 4.29256C27.358 4.11755 27.08 4.03004 26.7712 4.03004H23.7754V8.01409Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  d="M34.7734 13.6968C33.9807 13.6968 33.2704 13.5166 32.6424 13.1563C32.0247 12.7857 31.5357 12.2864 31.1754 11.6584C30.8151 11.0201 30.635 10.2944 30.635 9.48108C30.635 8.6678 30.8151 7.94717 31.1754 7.3192C31.5357 6.69122 32.0247 6.19708 32.6424 5.83676C33.2704 5.47645 33.9807 5.29629 34.7734 5.29629C35.5661 5.29629 36.2713 5.47645 36.889 5.83676C37.517 6.19708 38.0059 6.69122 38.356 7.3192C38.7163 7.94717 38.8964 8.6678 38.8964 9.48108C38.8964 10.2944 38.7163 11.0201 38.356 11.6584C38.0059 12.2864 37.517 12.7857 36.889 13.1563C36.2713 13.5166 35.5661 13.6968 34.7734 13.6968ZM34.7734 12.4923C35.319 12.4923 35.8029 12.3636 36.225 12.1062C36.6471 11.8386 36.9765 11.4783 37.2133 11.0253C37.4603 10.5723 37.5787 10.0576 37.5684 9.48108C37.5787 8.90458 37.4603 8.39499 37.2133 7.95232C36.9765 7.49935 36.6471 7.14419 36.225 6.88682C35.8029 6.62945 35.319 6.50077 34.7734 6.50077C34.2278 6.50077 33.7388 6.62945 33.3064 6.88682C32.8843 7.14419 32.5549 7.49935 32.3181 7.95232C32.0814 8.40529 31.963 8.91487 31.963 9.48108C31.963 10.0576 32.0814 10.5723 32.3181 11.0253C32.5549 11.4783 32.8843 11.8386 33.3064 12.1062C33.7388 12.3636 34.2278 12.4923 34.7734 12.4923Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  d="M40.3075 13.5423V2.11523H41.6046V13.5423H40.3075Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  d="M46.722 13.6968C46.0323 13.6968 45.4043 13.5166 44.8381 13.1563C44.2822 12.7857 43.8395 12.2812 43.5101 11.643C43.1807 11.0047 43.016 10.2841 43.016 9.48108C43.016 8.6678 43.1858 7.94717 43.5255 7.3192C43.8653 6.69122 44.3182 6.19708 44.8844 5.83676C45.4609 5.47645 46.1044 5.29629 46.8147 5.29629C47.2368 5.29629 47.6228 5.35806 47.9729 5.4816C48.3332 5.60513 48.6523 5.78014 48.9303 6.00662C49.2082 6.22281 49.4398 6.48018 49.6252 6.77873C49.8105 7.06698 49.934 7.37582 49.9958 7.70525L49.656 7.55083L49.6715 5.46615H50.9686V13.5423H49.6715V11.5812L49.9958 11.4113C49.9237 11.7099 49.7847 11.9981 49.5788 12.2761C49.3832 12.554 49.1362 12.8011 48.8376 13.0173C48.5494 13.2232 48.2251 13.3879 47.8648 13.5114C47.5044 13.635 47.1235 13.6968 46.722 13.6968ZM47.0309 12.4768C47.5559 12.4768 48.0192 12.3482 48.4207 12.0908C48.8222 11.8334 49.1413 11.4834 49.3781 11.0407C49.6149 10.5878 49.7332 10.0679 49.7332 9.48108C49.7332 8.90458 49.6149 8.39499 49.3781 7.95232C49.1516 7.50965 48.8325 7.15963 48.4207 6.90226C48.0192 6.6449 47.5559 6.51621 47.0309 6.51621C46.5059 6.51621 46.0426 6.6449 45.6411 6.90226C45.2396 7.15963 44.9205 7.50965 44.6837 7.95232C44.4572 8.39499 44.344 8.90458 44.344 9.48108C44.344 10.0576 44.4572 10.5723 44.6837 11.0253C44.9205 11.4783 45.2396 11.8334 45.6411 12.0908C46.0426 12.3482 46.5059 12.4768 47.0309 12.4768Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  d="M52.6352 13.5423V5.46615H53.9323L53.9632 7.73613L53.8242 7.35008C53.9375 6.96918 54.1228 6.62431 54.3802 6.31547C54.6375 6.00663 54.9412 5.75955 55.2912 5.57425C55.6515 5.38894 56.0325 5.29629 56.4339 5.29629C56.609 5.29629 56.7737 5.31173 56.9281 5.34262C57.0928 5.36321 57.2266 5.39409 57.3296 5.43527L56.9744 6.87138C56.8406 6.80961 56.7016 6.76328 56.5575 6.7324C56.4134 6.70152 56.2795 6.68607 56.156 6.68607C55.8266 6.68607 55.5229 6.74784 55.2449 6.87138C54.9772 6.99492 54.7456 7.16478 54.55 7.38097C54.3647 7.58686 54.2154 7.82878 54.1022 8.10674C53.9993 8.3847 53.9478 8.68324 53.9478 9.00238V13.5423H52.6352Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.59585 14.9566C7.33746 17.4894 12.4239 16.5094 14.9566 12.7678C17.4894 9.02622 16.5094 3.93982 12.7678 1.40705C9.02622 -1.12573 3.93982 -0.145767 1.40705 3.59585C-1.12573 7.33746 -0.145767 12.4239 3.59585 14.9566ZM4.6799 15.0233C8.10255 16.7743 12.4443 15.1307 14.3775 11.352C16.3107 7.57339 15.1033 3.09067 11.6806 1.3396C8.25798 -0.411473 3.91621 1.2322 1.98301 5.01084C0.049806 8.78948 1.25724 13.2722 4.6799 15.0233Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M5.64001 15.9169C8.72958 16.9225 12.3641 14.266 13.758 9.98345C15.1518 5.70093 13.7772 1.41408 10.6876 0.408493C7.59809 -0.597091 3.96355 2.05939 2.56968 6.34191C1.17582 10.6244 2.55045 14.9113 5.64001 15.9169ZM6.58615 15.5916C9.20086 16.1493 12.0281 13.2837 12.901 9.19119C13.7739 5.09866 12.3619 1.3289 9.74722 0.771202C7.13251 0.213505 4.30525 3.07906 3.43234 7.17159C2.55944 11.2641 3.97145 15.0339 6.58615 15.5916Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.31552 16.2665C9.38276 16.4873 11.4459 13.0392 11.9236 8.56507C12.4014 4.09092 11.1128 0.284969 9.04558 0.0642329C6.97834 -0.156503 4.91523 3.29157 4.43749 7.76571C3.95975 12.2399 5.24829 16.0458 7.31552 16.2665ZM8.28426 14.9048C9.78033 14.8811 10.9456 11.8525 10.8869 8.14017C10.8283 4.42782 9.56793 1.43753 8.07186 1.46116C6.57579 1.4848 5.41053 4.51342 5.46918 8.22577C5.52784 11.9381 6.78819 14.9284 8.28426 14.9048Z"
                  fill={darkmode ? '#FDFDFC' : '#364797'}
                />
              </svg>
            </div>
          </div>
        </div>

        {orgName &&
        upfront_split_to_contributors &&
        upfront_split_to_contributors > 0 ? (
          <div
            style={{
              width: '100%',
              backgroundColor: darkmode ? '#222c49' : '#F3F5FC',
              color: darkmode ? '#a6c7ea' : '#4667CA',
              fontSize: 10,
              padding: '4px 8px',
              borderTop: darkmode ? '1px solid #2e4070' : '1px solid #E1EAF8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Heart />

            <div
              style={{
                alignItems: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontWeight: 'bold',
              }}
            >
              {`@${orgName}`}
            </div>

            <div
              style={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                marginLeft: '-5px',
              }}
            >
              {`rewards contributors ${upfront_split_to_contributors}% after fees`}
            </div>
            <div
              style={{
                color: darkmode ? '#a6c7ea' : '#4667CA',
                background: darkmode ? '#464B64' : 'white',
                border: darkmode ? '1px solid #5E637D' : '1px solid #C9DBF4',
                borderRadius: 8,
                padding: '4px 8px',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              Contribute
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default Badge

const Heart = () => (
  <svg
    width="16"
    height="15"
    viewBox="0 0 16 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.73375 14.0462L7.7285 14.044L7.712 14.035C7.61547 13.9818 7.51971 13.9273 7.42475 13.8715C6.28311 13.1931 5.21621 12.3962 4.24175 11.4939C2.516 9.8837 0.6875 7.4942 0.6875 4.5512C0.6875 2.3552 2.5355 0.613701 4.766 0.613701C5.38606 0.610664 5.99884 0.747456 6.55874 1.0139C7.11865 1.28035 7.61128 1.6696 8 2.1527C8.3888 1.6695 8.88155 1.28019 9.4416 1.01374C10.0016 0.747289 10.6146 0.610551 11.2347 0.613701C13.4645 0.613701 15.3125 2.3552 15.3125 4.5512C15.3125 7.49495 13.484 9.88445 11.7582 11.4932C10.7838 12.3954 9.71691 13.1923 8.57525 13.8707C8.4803 13.9268 8.38454 13.9816 8.288 14.035L8.2715 14.044L8.26625 14.0469L8.264 14.0477C8.18267 14.0908 8.09203 14.1133 8 14.1133C7.90797 14.1133 7.81733 14.0908 7.736 14.0477L7.73375 14.0462Z"
      fill="#A5C2EB"
    />
  </svg>
)
