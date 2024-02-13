import GitHubIcon from '@/components/Icons/GitHubIcon'

const Embed = (props: { src: string }) => {
  if (
    typeof props.src === 'string' &&
    props.src.startsWith('https://github.com/')
  ) {
    return <EmbedIssue src={props.src} />
  }

  return (
    <div className="bg-gray-200 p-2 text-red-800">
      Unknown embed target ({props.src})
    </div>
  )
}

const EmbedIssue = (props: { src: string }) => {
  const m = props.src.match(
    /^https:\/\/github\.com\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/issues\/([0-9]+)/,
  )

  if (!m) {
    return (
      <div className="bg-gray-200 p-2 text-red-800">
        Unknown embed target ({props.src})
      </div>
    )
  }

  return (
    <table>
      <tbody>
        <tr>
          <td className="m-auto">
            <GitHubIcon className="h-4 w-4" />
          </td>
          <td className="m-auto pl-2">
            <a href={props.src}>
              {m[1]}/{m[2]}#{m[3]}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default Embed
