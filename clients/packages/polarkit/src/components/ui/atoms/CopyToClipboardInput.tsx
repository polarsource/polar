import { Input } from './'

const CopyToClipboardInput = (props: {
  id: string
  value: string
  onCopy?: () => void
}) => {
  const copyToClipboard = (id: string) => {
    const copyText = document.getElementById(id) as HTMLInputElement
    if (!copyText) {
      return
    }
    copyText.select()
    copyText.setSelectionRange(0, 99999)
    navigator.clipboard.writeText(copyText.value)

    if (props.onCopy) {
      props.onCopy()
    }
  }

  return (
    <div className="dark:border-polar-600 dark:bg-polar-700 flex w-full flex-row overflow-hidden rounded-lg border bg-white">
      <Input
        id={props.id}
        className="dark:text-polar-400 w-full grow rounded-l-lg rounded-r-none border-none font-mono text-sm text-gray-600"
        onClick={() => {
          copyToClipboard(props.id)
        }}
        value={props.value}
        readOnly={true}
      />
      <div
        className="dark:bg-polar-500/30 dark:text-polar-300 flex cursor-pointer items-center justify-center bg-blue-50 px-3 py-2 text-sm font-medium text-blue-500"
        onClick={() => {
          copyToClipboard(props.id)
        }}
      >
        Copy
      </div>
    </div>
  )
}

export default CopyToClipboardInput
