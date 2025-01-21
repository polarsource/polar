import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from './Button'
import { sections } from './Navigation'

export const Footer = ({ className }: { className?: string }) => {
  return (
    <div
      className={twMerge(
        'fixed bottom-0 left-0 right-0 hidden flex-row gap-x-12 p-12 text-xs md:flex',
        className,
      )}
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
        <Button variant="icon">H</Button>
        <Button variant="icon">L</Button>
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
      if (event.key === 'm') {
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
        <Button variant="icon">M</Button>
      </div>
      <span>Contact Us</span>
    </div>
  )
}
