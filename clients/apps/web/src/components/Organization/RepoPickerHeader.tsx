import { Repository } from '@polar-sh/sdk'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'

export const RepoPickerHeader = (props: {
  currentRepository?: Repository
  repositories: Repository[]
  children?: React.ReactNode
}) => {
  const onSubmit = () => {}

  return (
    <>
      <form
        className="dark:border-polar-700 flex flex-col space-y-2 bg-transparent md:flex-row md:items-center md:justify-between md:space-x-4 md:space-y-0"
        onSubmit={onSubmit}
      >
        <MaintainerRepoSelection
          current={props.currentRepository}
          repositories={props.repositories}
        />
        {props.children}
      </form>
    </>
  )
}
