import { useModal } from '@/components/Modal/useModal'
import {
  Button,
  Modal,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Plus } from '@polar-sh/orbit/icons'
import { EventCreationGuideModal } from './EventCreationGuideModal'

export const EventCreationGuideButton = () => {
  const { isShown, show, hide } = useModal()

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3!"
            onClick={show}
            aria-label="Create event"
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create event</TooltipContent>
      </Tooltip>
      <Modal
        title="Create Event"
        isShown={isShown}
        hide={hide}
        modalContent={<EventCreationGuideModal hide={hide} />}
      />
    </>
  )
}
