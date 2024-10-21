import { KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'

interface GuideCardProps {
  icon: 'nextjs' | 'express'
  title: string
  description: string
  href: string
}

export const GuideCard = ({
  icon,
  title,
  description,
  href,
}: GuideCardProps) => {
  const iconComponent = icon === 'nextjs' ? <NextJSLogo /> : <ExpressLogo />

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">{iconComponent}</CardHeader>
      <CardContent className="flex h-full flex-col gap-y-4 py-8">
        <h3 className="my-0">{title}</h3>
        <p className="dark:text-polar-500 mb-0 text-sm text-gray-500">
          {description}
        </p>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href={href}>
          <Button
            size="sm"
            wrapperClassNames="flex flex-row items-center gap-x-1"
          >
            <span>Get Started</span>
            <KeyboardArrowRight className="text-lg" fontSize="inherit" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

const NextJSLogo = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="32">
      <mask
        height="180"
        id=":r8:mask0_408_134"
        maskUnits="userSpaceOnUse"
        width="180"
        x="0"
        y="0"
        style={{ maskType: 'alpha' }}
      >
        <circle cx="90" cy="90" fill="black" r="90"></circle>
      </mask>
      <g mask="url(#:r8:mask0_408_134)">
        <circle cx="90" cy="90" data-circle="true" fill="black" r="90"></circle>
        <path
          d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z"
          fill="url(#:r8:paint0_linear_408_134)"
        ></path>
        <rect
          fill="url(#:r8:paint1_linear_408_134)"
          height="72"
          width="12"
          x="115"
          y="54"
        ></rect>
      </g>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id=":r8:paint0_linear_408_134"
          x1="109"
          x2="144.5"
          y1="116.5"
          y2="160.5"
        >
          <stop stop-color="white"></stop>
          <stop offset="1" stop-color="white" stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id=":r8:paint1_linear_408_134"
          x1="121"
          x2="120.799"
          y1="54"
          y2="106.875"
        >
          <stop stop-color="white"></stop>
          <stop offset="1" stop-color="white" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
    </svg>
  )
}

const ExpressLogo = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 50 50"
    >
      <path
        fill="currentColor"
        d="M49.729 11h-.85c-1.051 0-2.041.49-2.68 1.324l-8.7 11.377-8.7-11.377C28.162 11.49 27.171 11 26.121 11h-.85l10.971 14.346L25.036 40h.85c1.051 0 2.041-.49 2.679-1.324L37.5 26.992l8.935 11.684C47.073 39.51 48.063 40 49.114 40h.85L38.758 25.346 49.729 11zM21.289 34.242c-2.554 3.881-7.582 5.87-12.389 4.116C4.671 36.815 2 32.611 2 28.109L2 27h12v0h11l0-4.134c0-6.505-4.818-12.2-11.295-12.809C6.273 9.358 0 15.21 0 22.5l0 5.573c0 5.371 3.215 10.364 8.269 12.183 6.603 2.376 13.548-1.17 15.896-7.256 0 0 0 0 0 0h-.638C22.616 33 21.789 33.481 21.289 34.242zM2 22.5C2 16.71 6.71 12 12.5 12S23 16.71 23 22.5V25H2V22.5z"
      ></path>
    </svg>
  )
}
