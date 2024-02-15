const Iframe = (props: { src: string }) => {
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

const IframeYouTube = (props: { src: string }) => {
  const m = props.src.match(/\/embed\/(.*)\/?/)

  if (!m) {
    return (
      <div className="bg-gray-200 p-2 text-red-800">Invalid &lt;iframe&gt;</div>
    )
  }

  const thumb = `https://i.ytimg.com/vi/${m[1]}/hq720.jpg`
  return (
    <a href={`https://www.youtube.com/watch?v=${m[1]}`}>
      <img src={thumb} alt={'YouTube Thumbnail'} className="my-2 max-w-full" />
    </a>
  )
}

export default Iframe
