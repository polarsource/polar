const ShadowBox = (props: {
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div className="w-full rounded-xl bg-white p-5 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
    {props.children}
  </div>
)

export default ShadowBox
