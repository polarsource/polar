const Iframe = (props: {
  src: string
  width: number
  height: number
  title: string
  allow: String
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
  width: number
  height: number
  title: string
  allow: String
}) => {
  const r = 560 / 315 // youtube default ratios
  const w = 650 // width of the article container on our site
  const h = w / r // calculate appropriate height

  return (
    <iframe
      src={props.src}
      width={props.width || w}
      height={props.height || h}
      title={props.title}
      allow={props.title}
      className="my-2"
      frameBorder={0}
      allowFullScreen
    />
  )
}

export default Iframe
