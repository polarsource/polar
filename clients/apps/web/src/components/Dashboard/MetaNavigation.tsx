import { twMerge } from 'tailwind-merge'
import { metaRoutes } from './navigation'

const MetaNavigation = () => {
  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      {metaRoutes.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <a
            className={twMerge(
              'flex items-center gap-x-2 rounded-xl px-5 transition-colors',
              'dark:text-polar-500 text-gray-500 hover:text-blue-700 dark:hover:text-blue-500',
            )}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {'icon' in n && n.icon ? <span>{n.icon}</span> : undefined}
            <span className="text-sm">{n.title}</span>
            {'postIcon' in n && n.postIcon ? (
              <span>{n.postIcon}</span>
            ) : undefined}
          </a>
        </div>
      ))}
    </div>
  )
}

export default MetaNavigation
