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
    <div className="flex w-full overflow-hidden rounded-lg border">
      <input
        id={props.id}
        className="flex-1 rounded-l-lg px-3 py-2 font-mono text-sm text-gray-600 dark:text-gray-400"
        onClick={() => {
          copyToClipboard(props.id)
        }}
        value={props.value}
        readOnly={true}
      />
      <div
        className="cursor-pointer bg-blue-50 px-3 py-2 text-sm font-medium  text-blue-600 dark:bg-blue-500/30 dark:text-blue-300"
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
