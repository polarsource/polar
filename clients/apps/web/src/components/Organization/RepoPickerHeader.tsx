import { schemas } from '@polar-sh/client'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'

export const RepoPickerHeader = (props: {
  currentRepository?: schemas['Repository']
  repositories: schemas['Repository'][]
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
