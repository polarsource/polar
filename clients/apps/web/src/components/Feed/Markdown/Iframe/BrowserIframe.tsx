const Iframe = (props: {
  src: string
  width: number
  height: number
  title: string
  allow: string
}) => {
  if (typeof props.src !== 'string') {
    return (
      <div className="bg-gray-200 p-2 text-red-800">Invalid &lt;iframe&gt;</div>
    )
  }

  if (
    props.src.startsWith('//www.youtube.com/embed/') ||
    props.src.startsWith('https://www.youtube.com/embed/') ||
    props.src.startsWith('https://www.youtube-nocookie.com/embed/')
  ) {
    return <IframeYouTube {...props} />
  }

  return (
    <div className="bg-gray-200 p-2 text-red-800">Invalid &lt;iframe&gt;</div>
  )
}

const IframeYouTube = (props: {
  src: string
  title: string
  allow: string
}) => {
  return (
    <iframe
      src={props.src}
      title={props.title}
      allow={props.allow}
      className="my-2 aspect-[560/315] w-full max-w-full"
      frameBorder={0}
      allowFullScreen
    />
  )
}

export default Iframe
