const Footer = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 md:flex-row ">
      <a className="text-blue-500 hover:text-blue-500" href="/faq">
        Polar FAQ
      </a>
      <span className="dark:text-polar-500 text-gray-500">
        &copy; Polar Software Inc.
      </span>
    </div>
  )
}

export default Footer
