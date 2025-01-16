import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from './Button'
import { sections } from './Navigation'

export const Footer = ({ className }: { className?: string }) => {
  return (
    <div
      className={twMerge('hidden flex-row gap-x-12 text-xs md:flex', className)}
    >
      <NavigationLegend />
      <SectionsLegend />
      <OpenSourceLegend />
      <ContactUsLegend />
    </div>
  )
}

const NavigationLegend = () => {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row gap-x-2">
        <Button variant="icon">←</Button>
        <Button variant="icon">→</Button>
      </div>
      <span>Navigate</span>
    </div>
  )
}

const SectionsLegend = () => {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row gap-x-2">
        {sections.map((_, index) => (
          <Button key={index} variant="icon">
            {index}
          </Button>
        ))}
      </div>
      <span>Sections</span>
    </div>
  )
}

const OpenSourceLegend = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'o') {
        window.open('https://github.com/polarsource', '_blank')
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row gap-x-2">
        <Button variant="icon">O</Button>
      </div>
      <span>Open Source</span>
    </div>
  )
}

const ContactUsLegend = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'c') {
        window.open('mailto:birk@polar.sh', '_blank')
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row gap-x-2">
        <Button variant="icon">C</Button>
      </div>
      <span>Contact Us</span>
    </div>
  )
}
