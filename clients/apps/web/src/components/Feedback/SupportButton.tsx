import SupportIcon from '@mui/icons-material/Support'
import { schemas } from '@polar-sh/client'
import { useSidebar } from '@polar-sh/ui/components/atoms/Sidebar'
import { twMerge } from 'tailwind-merge'

import { FeedbackModal } from './FeedbackModal'
import { useSupportModal } from './useSupportModal'

export const SupportButton = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { isShown, defaultType, open, hide } = useSupportModal()

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={twMerge(
          'flex cursor-pointer flex-row items-center rounded-lg border border-transparent px-2 text-sm transition-colors dark:border-transparent',
          'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
        )}
      >
        <SupportIcon fontSize="inherit" />
        {!isCollapsed && <span className="ml-4 font-medium">Support</span>}
      </button>
      <FeedbackModal
        isShown={isShown}
        hide={hide}
        organization={organization}
        defaultType={defaultType}
      />
    </>
  )
}
