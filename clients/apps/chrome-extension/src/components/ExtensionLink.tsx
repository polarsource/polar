const ExtensionLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const openInNewTab = (url: string) => {
    chrome.tabs.create({ url })
  }

  return <button onClick={() => openInNewTab(href)}>{children}</button>
}

export default ExtensionLink
