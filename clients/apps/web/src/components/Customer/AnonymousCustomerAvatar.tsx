import { useAnonymousCustomerName } from '@/utils/anonymous-customer'
import { useId, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface AnonymousCustomerAvatarProps {
  externalId: string
  className?: string
}

export const AnonymousCustomerAvatar = ({
  externalId,
  className,
}: AnonymousCustomerAvatarProps) => {
  const [, color, shape] = useAnonymousCustomerName(externalId)

  const [hue, s, l] = useMemo(() => {
    switch (color) {
      case 'Red':
        return [0, 84, 60]
      case 'Orange':
        return [25, 95, 53]
      case 'Amber':
        return [44, 100, 50]
      case 'Yellow':
        return [50, 98, 64]
      case 'Lime':
        return [82, 85, 67]
      case 'Green':
        return [142, 69, 58]
      case 'Emerald':
        return [142, 69, 58]
      case 'Teal':
        return [171, 77, 64]
      case 'Cyan':
        return [188, 86, 53]
      case 'Sky':
        return [199, 95, 74]
      case 'Blue':
        return [224, 76, 48]
      case 'Indigo':
        return [245, 58, 51]
      case 'Violet':
        return [258, 90, 66]
      case 'Purple':
        return [271, 91, 65]
      case 'Fuchsia':
        return [292, 84, 61]
      case 'Pink':
        return [327, 87, 82]
      case 'Rose':
        return [351, 95, 71]
      default:
        return [0, 100, 37]
    }
  }, [color])

  const id = useId()

  return (
    <div
      className={twMerge(
        'relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-black',
        className,
      )}
    >
      <div className="absolute inset-0 rounded-full ring ring-black/5 ring-inset dark:ring-white/10" />
      <svg viewBox="0 0 24 24" fill="white">
        <defs>
          <linearGradient
            gradientTransform="rotate(-51, 0.5, 0.5)"
            x1="50%"
            y1="0%"
            x2="50%"
            y2="100%"
            id={`${id}-gradient-1`}
          >
            <stop
              stopColor={`hsl(${hue + 15} ${s}% ${l}%)`}
              stopOpacity="1"
              offset="-0%"
            ></stop>
            <stop
              stopColor="rgba(255,255,255,0)"
              stopOpacity="0"
              offset="100%"
            ></stop>
          </linearGradient>
          <linearGradient
            gradientTransform="rotate(51, 0.5, 0.5)"
            x1="50%"
            y1="0%"
            x2="50%"
            y2="100%"
            id={`${id}-gradient-2`}
          >
            <stop
              stopColor={`hsl(${hue - 15} ${s}% ${l}%)`}
              stopOpacity="1"
            ></stop>
            <stop
              stopColor="rgba(255,255,255,0)"
              stopOpacity="0"
              offset="100%"
            ></stop>
          </linearGradient>
          <filter
            id={`${id}-saturate`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            filterUnits="objectBoundingBox"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="saturate"
              values="1.5"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
              in="SourceGraphic"
              result="colormatrix"
            ></feColorMatrix>
          </filter>
          <mask
            id={`${id}-shape-mask`}
            fill="currentColor"
            className="text-white"
          >
            {shape === 'Square' ? (
              <rect x={7} y={7} width={10} height={10}></rect>
            ) : shape === 'Triangle' ? (
              <polygon points="12,7 17,15.5 7,15.5"></polygon>
            ) : shape === 'Dot' ? (
              <circle cx={12} cy={12} r={5}></circle>
            ) : shape === 'Diamond' ? (
              <polygon points="12,6 18,12 12,18 6,12"></polygon>
            ) : shape === 'Hexagon' ? (
              <polygon points="12,6.5 17,10 17,14 12,17.5 7,14 7,10"></polygon>
            ) : shape === 'Octagon' ? (
              <polygon points="10,7 14,7 17,10 17,14 14,17 10,17 7,14 7,10"></polygon>
            ) : shape === 'Trapezium' ? (
              <polygon points="9,7 15,7 18,16 6,16"></polygon>
            ) : shape === 'Pentagon' ? (
              <polygon points="12,6 17.5,11 15.5,17 8.5,17 6.5,11"></polygon>
            ) : shape === 'Cube' ? (
              <>
                <polygon points="12,6 18,9 12,12 6,9"></polygon>
                <polygon points="6,9.5 11.5,12.5 11.5,18 6,15"></polygon>
                <polygon points="12.5,12.5 18,9.5 18,15 12.5,18"></polygon>
              </>
            ) : shape === 'Pyramid' ? (
              <>
                <polygon points="11.5,6 6,14.5 11.5,18"></polygon>
                <polygon points="12.5,6 12.5,18 18,14.5"></polygon>
              </>
            ) : shape === 'Torus' ? (
              <circle
                cx={12}
                cy={12}
                r={4.5}
                stroke="currentColor"
                strokeWidth={3}
                fill="none"
              />
            ) : null}
          </mask>
        </defs>
        <g
          className="opacity-30 dark:opacity-10"
          filter={`url(#${id}-saturate)`}
        >
          <rect
            width="100%"
            height="100%"
            fill={`hsl(${hue} ${s}% ${l}%)`}
          ></rect>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${id}-gradient-1)`}
          ></rect>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${id}-gradient-2)`}
          ></rect>
        </g>
        <g
          filter={`url(#${id}-saturate)`}
          mask={`url(#${id}-shape-mask)`}
          className="opacity-95 dark:opacity-60"
        >
          <rect
            width="100%"
            height="100%"
            fill={`hsl(${hue} ${s}% ${l}%)`}
          ></rect>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${id}-gradient-1)`}
          ></rect>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${id}-gradient-2)`}
          ></rect>
        </g>
      </svg>
    </div>
  )
}
