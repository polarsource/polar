import { Img } from '@react-email/components'

export const Check = ({ width, height }: { width: number; height: number }) => {
  return (
    <Img
      src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/benefit-icons/check.png"
      alt="Check"
      width={width}
      height={height}
    />
  )
}

export const GitHub = ({
  width,
  height,
}: {
  width: number
  height: number
}) => {
  return (
    <Img
      src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/benefit-icons/github.png"
      alt="GitHub"
      width={width}
      height={height}
    />
  )
}

export const Download = ({
  width,
  height,
}: {
  width: number
  height: number
}) => {
  return (
    <Img
      src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/benefit-icons/download.png"
      alt="Download"
      width={width}
      height={height}
    />
  )
}

export const Key = ({ width, height }: { width: number; height: number }) => {
  return (
    <Img
      src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/benefit-icons/key.png"
      alt="Key"
      width={width}
      height={height}
    />
  )
}

export const Gauge = ({ width, height }: { width: number; height: number }) => {
  return (
    <Img
      src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/benefit-icons/gauge.png"
      alt="Gauge"
      width={width}
      height={height}
    />
  )
}
