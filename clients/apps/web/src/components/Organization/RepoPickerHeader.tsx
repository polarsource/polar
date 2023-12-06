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
        className="dark:border-polar-700 flex flex-row items-center justify-between space-x-4 space-y-0 bg-transparent"
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
