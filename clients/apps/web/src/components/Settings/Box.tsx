import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

const Box = (props: {
  children: React.ReactElement | React.ReactElement[]
}) => (
  <ShadowBox>
    <form className="flex flex-col space-y-4">{props.children}</form>
  </ShadowBox>
)

export default Box
