const ShadowBox = (props: { children: React.ReactElement }) => (
  <div className="w-full rounded-xl bg-white p-5 shadow">{props.children}</div>
)

export default ShadowBox
