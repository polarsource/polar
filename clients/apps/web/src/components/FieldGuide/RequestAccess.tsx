'use client'

/**
 * The manual's way in: a bracketed mono command that inverts to a solid Snow block on hover, and takes the reader down
 * to the early access form at the end of the book.
 */
export function RequestAccess() {
  return (
    <a
      href="#early-access"
      onClick={(e) => {
        e.preventDefault()
        document
          .getElementById('early-access')
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }}
      className="group px-1 py-1 font-mono text-[13px] leading-none whitespace-pre text-[#d8d8d8] no-underline transition-colors hover:bg-[#d8d8d8] hover:text-[#141414]"
    >
      <span className="text-[#7b7b7b] transition-colors group-hover:text-[#141414]">
        [
      </span>{' '}
      Request early access{' '}
      <span className="text-[#7b7b7b] transition-colors group-hover:text-[#141414]">
        ]
      </span>
    </a>
  )
}
