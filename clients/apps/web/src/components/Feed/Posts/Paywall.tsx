const Paywall = (props: {
  children?: React.ReactNode
  renderer?: typeof BrowserPaywall
}) => {
  if (props.renderer) {
    const C = props.renderer
    return <C />
  }

  return <BrowserPaywall>{props.children}</BrowserPaywall>
}

const BrowserPaywall = (props: { children?: React.ReactNode }) => {
  if (
    !props.children ||
    (Array.isArray(props.children) && props.children.length === 0)
  ) {
    return (
      <div className="border-2 border-l-4 border-green-800 bg-green-300 p-2">
        This content is for paid subscribers only. Subscribe to XXXXXXX to get
        access to it.
      </div>
    )
  }
  return <div className="bg-red-200 p-4">{props.children}</div>
}

export default Paywall
