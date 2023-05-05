const PageNotFound = () => {
  return (
    <div className="flex grow items-center justify-center">
      <div className="flex-row">
        <div className="space-y-2">
          <p>This page could not be found.</p>
          <p>
            <a href="/" className="animate-pulse font-mono font-bold">
              GOTO /
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default PageNotFound
