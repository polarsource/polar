const SettingsPage: NextPage = ({ organization }) => {
  return (
    <>
      <div className="mx-auto mt-24 max-w-[1100px] divide-y divide-gray-200 ">
        <Section>
          <SectionDescription
            title="Polar badge"
            description="Polar will inject this badge into new issues on Github."
          />

          <Box>
            <Checbox
              title="Add badge to old issues as well"
              description="Could impact sorting on GitHub"
            />
            <Checbox title="Show amount raised" />
          </Box>
        </Section>

        <Section>
          <SectionDescription
            title="Email notifications"
            description="Polar will send emails for the notifications enabled below."
          />

          <Box>
            <Checbox title="Issue receives backing" />
            <Checbox title="Branch created for issue with backing" />
            <Checbox title="Pull request created for issue with backing" />
            <Checbox title="Pull request merged for issue with backing" />
          </Box>
        </Section>

        <Section>
          <SectionDescription title="Delete account" description="" />

          <Box>xx</Box>
        </Section>
      </div>
    </>
  )
}

const Section = ({ children }) => {
  return <div className="flex space-x-20 py-10">{children}</div>
}

const SectionDescription = ({ title, description }) => {
  return (
    <div className="w-80">
      <h2 className="text-[#101828]">{title}</h2>
      <p className="text-black/50">{description}</p>
    </div>
  )
}

const Box = ({ children }) => {
  return (
    <div className=" w-full rounded-md bg-white p-5 shadow-[0_0_15px_-5px_rgba(0,0,0,0.3)]">
      <form className="flex flex-col space-y-4">{children}</form>
    </div>
  )
}
const Checbox = ({ title, description = '' }) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id="comments"
          aria-describedby="comments-description"
          name="comments"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-[#8A63F9] focus:ring-[#8A63F9]"
        />
      </div>
      <div className="ml-3 text-sm leading-6">
        <label htmlFor="comments" className="font-medium text-black">
          {title}
        </label>{' '}
        <span id="comments-description" className="text-black/50">
          {description}
        </span>
      </div>
    </div>
  )
}

export default SettingsPage
