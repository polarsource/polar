import { ArrowForward } from '@mui/icons-material'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { Section, SectionProps } from './Section'

export interface FeatureSectionProps extends Omit<SectionProps, 'children'> {
  title: string
  description: string
  features: string[]
  media: {
    light: string
    dark: string
  }
  direction?: 'row' | 'row-reverse'
}

export const FeatureSection = ({
  id,
  wrapperClassName,
  className,
  title,
  description,
  features,
  media,
  direction = 'row',
}: FeatureSectionProps) => {
  return (
    <Section
      id={id}
      className={twMerge(
        'flex flex-col-reverse gap-16 md:justify-between md:gap-32 md:py-24',
        direction === 'row' ? 'md:flex-row' : 'md:flex-row-reverse',
        className,
      )}
      wrapperClassName={wrapperClassName}
    >
      <picture className="md:w-1/2">
        <source media="(prefers-color-scheme: dark)" srcSet={media.dark} />
        <img
          className="dark:border-polar-700 rounded-2xl border border-gray-200 shadow-sm"
          src={media.light}
        />
      </picture>
      <div className="flex flex-col gap-y-6 md:w-1/2">
        <div className="flex flex-col gap-y-4">
          <h1 className="text-2xl md:text-4xl md:leading-snug">{title}</h1>
          <p className="dark:text-polar-200 text-lg text-gray-500 md:text-xl md:leading-normal">
            {description}
          </p>
        </div>
        <ul className="flex flex-col gap-y-2">
          {features.map((feature) => (
            <ListItem key={feature}>{feature}</ListItem>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const ListItem = ({ children }: PropsWithChildren) => {
  return (
    <li className="flex flex-row gap-x-2 leading-snug">
      <ArrowForward fontSize="small" />
      <span>{children}</span>
    </li>
  )
}
