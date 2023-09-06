const ShadowBoxOnLg = (props: {
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div className="w-full lg:rounded-xl lg:bg-white lg:p-5 lg:shadow lg:dark:bg-gray-800 lg:dark:ring-1 lg:dark:ring-gray-700">
    {props.children}
  </div>
)

export default ShadowBoxOnLg
