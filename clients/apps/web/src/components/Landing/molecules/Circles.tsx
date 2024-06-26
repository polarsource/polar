import { ComponentProps } from 'react'

export const Circles = (props: Partial<ComponentProps<'svg'>>) => {
  return (
    <svg
      viewBox="0 0 1920 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g>
        <circle
          cx="958.043"
          cy="535.487"
          r="1000"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
        <circle
          cx="958.043"
          cy="535.487"
          r="800"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
        <circle
          cx="958.154"
          cy="535.487"
          r="600"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
        <circle
          cx="958.265"
          cy="535.487"
          r="400"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
        <circle
          cx="958.376"
          cy="536.376"
          r="200"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
        <circle
          cx="958.376"
          cy="536.376"
          r="50"
          stroke="currentColor"
          strokeOpacity="0.05"
        />
      </g>
    </svg>
  )
}
