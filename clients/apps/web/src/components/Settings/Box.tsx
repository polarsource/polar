const Box = (props: { children: React.ReactElement }) => (
  <ShadowBox>
    <form className="flex flex-col space-y-4">{children}</form>
  </ShadowBox>
)

export default Box
