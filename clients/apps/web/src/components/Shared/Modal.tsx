// Deprecated!
// Use @/components/Modal instead
const Modal = ({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactElement
}) => {
  return (
    <Background onClick={onClose}>
      <div
        className="h-full w-full p-8 md:h-min md:w-[400px] md:p-0"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {children}
      </div>
    </Background>
  )
}

export default Modal

const Background = ({
  children,
  onClick,
}: {
  children: React.ReactElement
  onClick: () => void
}) => {
  return (
    <div
      onClick={onClick}
      className="fixed bottom-0 left-0 right-0 top-0 z-20 flex items-center justify-center bg-black/50"
    >
      {children}
    </div>
  )
}

export const ModalBox = ({ children }: { children: React.ReactElement }) => {
  return (
    <div className="z-0 block flex h-full w-full flex-col space-y-2 overflow-hidden rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-700">
      {children}
    </div>
  )
}
