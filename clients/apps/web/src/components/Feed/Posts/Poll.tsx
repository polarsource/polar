const InvalidPoll = () => (
  <div className="my-2 bg-gray-100 p-8 text-gray-400">
    This <code>&lt;Poll&gt;</code> is not configured correctly.
  </div>
)

const Poll = (props: {
  children?: React.ReactNode
  renderer?: typeof BrowserPoll
}) => {
  if (!props.children || typeof props.children !== 'object') {
    return <InvalidPoll />
  }

  let child = props.children
  if (Array.isArray(child)) {
    if (child.length > 0) {
      child = child[0]
    }
  }

  if (!('type' in child)) {
    return <InvalidPoll />
  }

  let options: string[] = []

  const getStr = (c: any): string | undefined => {
    if (typeof c === 'string') {
      return c
    }

    if (typeof c === 'object' && Array.isArray(c) && c.length === 1) {
      return getStr(c[0])
    }

    return undefined
  }

  if (child.type === 'ol') {
    options = child.props.children
      .map((c: React.ReactHTMLElement<HTMLLIElement>) => c.props.children)
      .map(getStr)
      .filter((s: any) => typeof s === 'string')
  } else if (child.type == 'ul') {
    options = child.props.children
      .map((c: React.ReactHTMLElement<HTMLLIElement>) => c.props.children)
      .map(getStr)
      .filter((s: any) => typeof s === 'string')
  } else {
    return <InvalidPoll />
  }

  if (options.length === 0) {
    return <InvalidPoll />
  }

  if (props.renderer) {
    const C = props.renderer
    return <C options={options} />
  }

  return <BrowserPoll options={options} />
}

const BrowserPoll = (props: { options: string[] }) => {
  return (
    <div className="my-2 flex flex-col space-y-2 bg-blue-300 p-8">
      {props.options.map((s) => (
        <div className="item-center flex justify-between bg-black/20 p-2">
          <div>{s}</div>
          <div>123 votes (10%)</div>
        </div>
      ))}
    </div>
  )
}

export default Poll
