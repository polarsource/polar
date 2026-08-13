import AccessRestricted from '@/components/Finance/AccessRestricted'
import { Modal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const RestrictedModal = ({
  title,
  isShown,
  hide,
  message,
}: {
  title: string
  isShown: boolean
  hide: () => void
  message: string
}) => (
  <Modal
    title={title}
    className="min-w-100"
    isShown={isShown}
    hide={hide}
    modalContent={
      <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
        <AccessRestricted message={message} />
      </Box>
    }
  />
)
