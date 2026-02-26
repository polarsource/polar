import { getResizedImage } from '@/utils/getResizedImage'

type ImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width'
> & {
  src: string | null | undefined
  width: number
}

export const Image = ({ src, width, ...props }: ImageProps) => (
  // eslint-disable-next-line no-restricted-syntax, @next/next/no-img-element
  <img src={getResizedImage(src, width)} {...props} />
)
