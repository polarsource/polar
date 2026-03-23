import { getResizedImage } from '@/utils/getResizedImage'

type ImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width'
> & {
  src: string | null | undefined
  approximateWidth: number
}

export const UploadImage = ({
  src,
  approximateWidth,
  ...props
}: ImageProps) => (
  // eslint-disable-next-line no-restricted-syntax, @next/next/no-img-element
  <img src={getResizedImage(src, approximateWidth)} {...props} />
)
