import { LinkOutlined } from '@mui/icons-material'
import Link from 'next/link'

const AnchorLink = ({ id }: { id: string }) => {
  return (
    <Link
      href={`#${id}`}
      className="dark:text-polar-500 text-gray-500 opacity-0 transition-opacity hover:text-blue-500 group-hover:opacity-100 dark:hover:text-blue-400"
    >
      <LinkOutlined />
    </Link>
  )
}

const AnchoredElement = ({
  id: _id,
  children,
}: React.PropsWithChildren<{
  id: string | string[]
  className?: string
}>) => {
  const id = Array.isArray(_id) ? _id.join('-') : _id
  return (
    <div id={id} className="group inline-flex items-center gap-2">
      {children}
      <AnchorLink id={id} />
    </div>
  )
}

export default AnchoredElement
