import { classNames } from 'utils/dom'

const teams = [
  { name: 'hubben/server', href: '#', bgColorClass: 'bg-indigo-500' },
  { name: 'pydantic/pydantic', href: '#', bgColorClass: 'bg-green-500' },
  { name: 'pallets/flask', href: '#', bgColorClass: 'bg-yellow-500' },
]

const Starred = () => {
  return (
    <>
      <div className="mt-8">
        {/* Secondary navigation */}
        <h3
          className="px-3 text-sm font-medium text-gray-500"
          id="desktop-teams-headline"
        >
          Starred
        </h3>
        <div
          className="mt-1 space-y-1"
          role="group"
          aria-labelledby="desktop-teams-headline"
        >
          {teams.map((team) => (
            <a
              key={team.name}
              href={team.href}
              className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <span
                className={classNames(
                  team.bgColorClass,
                  'w-2.5 h-2.5 mr-4 rounded-full',
                )}
                aria-hidden="true"
              />
              <span className="truncate">{team.name}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

export default Starred
