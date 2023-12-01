import { SubscriptionTierType } from '@polar-sh/sdk'
import { useMemo } from 'react'

interface SubscriptionTierCelebrationProps {
  type: SubscriptionTierType
}

const SubscriptionTierCelebration: React.FC<
  SubscriptionTierCelebrationProps
> = ({ type }) => {
  const [gradientColorStart, gradientColorEnd] = useMemo(() => {
    switch (type) {
      case SubscriptionTierType.FREE:
        return ['#b075c9', '#cfacdf']
      case SubscriptionTierType.HOBBY:
        return ['#DBF2FF', '#B1C7FF']
      case SubscriptionTierType.PRO:
        return ['#FFDFEE', '#C79BE9']
      case SubscriptionTierType.BUSINESS:
        return ['#FFF4E0', '#FFC7A7']
    }
  }, [type])

  return (
    <svg
      width="221"
      height="84"
      viewBox="0 0 221 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="10.4355"
        y="73.9209"
        width="5"
        height="5"
        rx="1"
        transform="rotate(16.695 10.4355 73.9209)"
        fill="#FFD361"
      />
      <rect
        x="177"
        y="39.5381"
        width="5"
        height="5"
        rx="1"
        transform="rotate(-31.5769 177 39.5381)"
        fill="#7492FF"
      />
      <rect
        x="156.015"
        y="74.3962"
        width="5"
        height="5"
        rx="1"
        transform="rotate(16.695 156.015 74.3962)"
        fill="#8FE3C5"
      />
      <path
        d="M1.05298 39.3962C1.05298 39.3962 0.181465 31.6238 5.50763 26.3462C10.8338 21.0687 18 22.6039 18 22.6039"
        stroke="#7492FF"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="37" cy="42.3962" r="4.5" stroke="#9AEDFF" />
      <circle cx="161" cy="45.3962" r="2.5" stroke="#FFD361" />
      <circle cx="166" cy="12.3962" r="3" fill="#FF9AA8" />
      <circle cx="202" cy="61.3962" r="3" fill="#61C6FF" />
      <path
        d="M60.1807 3.84335C60.845 3.45438 61.6812 3.9304 61.6859 4.70019L61.7283 11.6283C61.733 12.398 60.9026 12.8843 60.2336 12.5034L54.2125 9.0761C53.5435 8.69528 53.5377 7.73305 54.202 7.34408L60.1807 3.84335Z"
        fill="#8FE3C5"
      />
      <path
        d="M59.2929 76.8632C59.1043 76.1169 59.7944 75.4463 60.535 75.6561L63.8679 76.6004C64.6086 76.8103 64.8443 77.7432 64.2923 78.2797L61.808 80.6939C61.2559 81.2304 60.3301 80.9681 60.1415 80.2218L59.2929 76.8632Z"
        fill="#61C6FF"
      />
      <path
        d="M180.299 18.2485C180.299 18.2485 189.336 14.2814 198.065 21.1088C206.794 27.9363 208.073 39.9725 208.073 39.9725"
        stroke="#8FE3C5"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M52.8186 54.7266C51.3806 55.8636 52.6435 57.4608 51.2057 58.5978C49.7677 59.7349 48.5047 58.1377 47.0667 59.2748C45.6288 60.4118 46.8918 62.009 45.4538 63.1461C44.0158 64.2832 42.7528 62.686 41.3148 63.8231C39.8769 64.9601 41.1399 66.5573 39.7019 67.6944"
        stroke="#8FE3C5"
        stroke-miterlimit="10"
        stroke-linecap="round"
      />
      <path
        d="M174 62.5498C175.395 63.7388 176.716 62.1891 178.111 63.3781C179.507 64.5671 178.186 66.1169 179.581 67.306C180.976 68.4949 182.297 66.9452 183.693 68.1342C185.088 69.3233 183.767 70.8731 185.162 72.0622C186.558 73.2511 187.878 71.7014 189.274 72.8904"
        stroke="#FF9AA8"
        stroke-miterlimit="10"
        stroke-linecap="round"
      />
      <path
        d="M106 6.3094C108.475 4.88034 111.525 4.88034 114 6.3094L137.177 19.6906C139.652 21.1197 141.177 23.7607 141.177 26.6188V53.3812C141.177 56.2393 139.652 58.8803 137.177 60.3094L114 73.6906C111.525 75.1197 108.475 75.1197 106 73.6906L82.8231 60.3094C80.3479 58.8803 78.8231 56.2393 78.8231 53.3812V26.6188C78.8231 23.7607 80.3479 21.1197 82.8231 19.6906L106 6.3094Z"
        fill="url(#paint0_linear_1064_4979)"
      />
      <path
        d="M106 6.3094C108.475 4.88034 111.525 4.88034 114 6.3094L137.177 19.6906C139.652 21.1197 141.177 23.7607 141.177 26.6188V53.3812C141.177 56.2393 139.652 58.8803 137.177 60.3094L114 73.6906C111.525 75.1197 108.475 75.1197 106 73.6906L82.8231 60.3094C80.3479 58.8803 78.8231 56.2393 78.8231 53.3812V26.6188C78.8231 23.7607 80.3479 21.1197 82.8231 19.6906L106 6.3094Z"
        fill="url(#paint1_linear_1064_4979)"
      />
      <g clip-path="url(#clip0_1064_4979)">
        <path
          d="M105.75 47.2338L99.8427 41.5L97.8311 43.4388L105.75 51.125L122.75 34.625L120.753 32.6863L105.75 47.2338Z"
          fill="white"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_1064_4979"
          x1="152.458"
          y1="-60.5"
          x2="172.114"
          y2="77.3192"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color={gradientColorStart} />
          <stop offset="1" stop-color={gradientColorEnd} />
        </linearGradient>
        <clipPath id="clip0_1064_4979">
          <rect
            width="34"
            height="33"
            fill="white"
            transform="translate(93 25)"
          />
        </clipPath>
      </defs>
    </svg>
  )
}

export default SubscriptionTierCelebration
