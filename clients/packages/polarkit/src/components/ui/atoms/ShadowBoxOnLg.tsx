const ShadowBoxOnLg = (props: {
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div className="lg:dark:bg-polar-900 lg:dark:ring-polar-700 w-full lg:rounded-xl lg:bg-white lg:p-5 lg:shadow lg:dark:ring-1">
    {props.children}
  </div>
)

export default ShadowBoxOnLg
