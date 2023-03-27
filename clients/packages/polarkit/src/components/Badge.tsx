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
const flexStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
}

const badgeContainerStyle = {
  background: '#FFFFFF',
  boxShadow:
    '0px 1px 8px rgba(0, 0, 0, 0.07), 0px 0.5px 2.5px rgba(0, 0, 0, 0.2)',
  borderRadius: '11px',
  ...flexStyle,
  justifyContent: 'space-between',
}

const buttonStyle = {
  borderRadius: '6px',
  color: '#FFFFFF',
  textAlign: 'center',
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 16px',
  lineHeight: '20px',
  marginRight: '6px',
}

export const Badge = ({
  width = 445,
  height = 44,
  showAmountRaised = false,
}: {
  width?: number
  height?: number
  showAmountRaised: boolean
}) => {
  return (
    <>
      <div
        className="badge-container"
        style={{
          width: width,
          height: height - 3, // Room for box shadow
          ...badgeContainerStyle,
        }}
      >
        <div
          className="badge-content"
          style={{
            padding: '6px',
            ...flexStyle,
          }}
        >
          <div
            className="badge-back-button"
            style={{
              width: '100px',
              height: '30px',
              background: '#8A63F9',
              ...buttonStyle,
            }}
          >
            Back issue
          </div>
          <div
            style={{
              border: '1px solid rgba(0, 0, 0, 0.2)',
              ...buttonStyle,
              color: '#000',
              height: '30px',
            }}
          >
            Fix it
          </div>
          {showAmountRaised && (
            <div style={{ ...flexStyle }}>
              <p
                style={{
                  background: 'rgba(250, 232, 172, 0.7)',
                  border: '1px solid rgba(214, 180, 65, 0.14)',
                  borderRadius: '70px',
                  padding: '2px 9px',
                  fontWeight: 500,
                  color: '#000',
                  margin: '0 6px',
                }}
              >
                $250
              </p>{' '}
              <p
                style={{
                  width: '90px',
                  color: 'rgba(0, 0, 0, 0.5)',
                  marginRight: '6px',
                }}
              >
                raised from
              </p>
              <img
                src="https://avatars.githubusercontent.com/u/281715?v=4"
                width={24}
                height={24}
                style={{
                  objectFit: 'cover',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                }}
              />
            </div>
          )}
        </div>
        <div
          style={{
            background: '#F6F8FA',
            borderLeft: '1px solid rgba(0, 0, 0, 0.04)',
            borderRadius: '0 11px 11px 0',
            ...flexStyle,
            alignContent: 'center',
            flexDirection: 'column',
            padding: '8px 21px',
            height: height - 3,
          }}
        >
          <svg
            width="14"
            height="13"
            viewBox="0 0 14 13"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.1045 7.07617L8.00684 6.98828L12.7441 8.84277L12.4893 9.45801L7.83105 7.40137L11.5049 10.9258L11.0303 11.4004L7.50586 7.74414L9.53613 12.3848L8.92969 12.6572L7.0752 7.90234L7.18066 13H6.5127L6.62695 7.90234L4.77246 12.6572L4.15723 12.3848L6.19629 7.74414L2.66309 11.4004L2.19727 10.9258L5.87109 7.40137L1.2041 9.45801L0.958008 8.84277L5.68652 6.98828L0.597656 7.09375V6.4082L5.68652 6.52246L0.958008 4.66797L1.2041 4.05273L5.87109 6.10938L2.19727 2.57617L2.66309 2.11035L6.19629 5.7666L4.15723 1.11719L4.77246 0.853516L6.62695 5.59961L6.5127 0.510742H7.18066L7.0752 5.59961L8.92969 0.853516L9.53613 1.11719L7.50586 5.7666L11.0303 2.11035L11.5049 2.57617L7.83105 6.10938L12.4893 4.05273L12.7441 4.66797L8.00684 6.52246L13.1045 6.4082V7.07617Z"
              fill="black"
              fillOpacity="0.5"
            />
          </svg>
        </div>
      </div>
    </>
  )
}

export default Badge
