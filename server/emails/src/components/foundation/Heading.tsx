import { Heading as ReactEmailHeading } from 'react-email'

interface HeadingProps {
  children: React.ReactNode
  align?: 'left' | 'center'
}

export function Heading({ children, align = 'left' }: HeadingProps) {
  return (
    <ReactEmailHeading
      className={`my-[16px] text-[20px] font-bold ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      {children}
    </ReactEmailHeading>
  )
}

export default Heading
