import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { classNames } from 'polarkit/utils/dom'
import { useUserOrganizations, RepoListItem } from 'polarkit/hooks'
import { requireAuth } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useNavigate } from 'react-router-dom'

const RepoSelection = () => {
  const navigate = useNavigate()
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)

  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  if (!currentUser) {
    return <div>Not authenticated</div>
  }

  // TODO: Add loading indicator to the Listbox instead
  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  const organizations = userOrgQuery.data
  const repositories = userOrgQuery.repositories

  const setSelected = (repo: RepoListItem) => {
    const { organization, ...repoWithoutOrg } = repo
    setCurrentOrgRepo(organization, repoWithoutOrg)
  }

  const onChanged = (repo: RepoListItem) => {
    setSelected(repo)
    navigate(`/dashboard/${repo.organization.name}/${repo.name}`)
  }

  if (!currentOrg || !currentRepo) {
    return null
  }

  return (
    <Listbox value={currentRepo} onChange={onChanged}>
      {({ open }) => (
        <>
          <div className="relative mt-1 w-full">
            <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
              <span className="flex items-center">
                <img
                  src={currentOrg.avatar_url}
                  alt=""
                  className="h-6 w-6 flex-shrink-0 rounded-full"
                />
                <span className="ml-3 block truncate">
                  {currentOrg.name} / {currentRepo.name}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {repositories.map((repo) => (
                  <Listbox.Option
                    key={repo.id}
                    className={({ active }) =>
                      classNames(
                        active ? 'text-white bg-indigo-600' : 'text-gray-900',
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                      )
                    }
                    value={repo}
                  >
                    {({ selected, active }) => (
                      <>
                        <div className="flex items-center">
                          <img
                            src={repo.organization.avatar_url}
                            alt=""
                            className="h-6 w-6 flex-shrink-0 rounded-full"
                          />
                          <span
                            className={classNames(
                              selected ? 'font-semibold' : 'font-normal',
                              'ml-3 block truncate',
                            )}
                          >
                            {repo.organization.name} / {repo.name}
                          </span>
                        </div>

                        {selected ? (
                          <span
                            className={classNames(
                              active ? 'text-white' : 'text-indigo-600',
                              'absolute inset-y-0 right-0 flex items-center pr-4',
                            )}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </>
      )}
    </Listbox>
  )
}

export default RepoSelection
