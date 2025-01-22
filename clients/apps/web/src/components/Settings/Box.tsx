import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'

const Box = (props: {
  children: React.ReactElement | React.ReactElement[]
}) => (
  <ShadowBox>
    <form className="flex flex-col space-y-4">{props.children}</form>
  </ShadowBox>
)

export default Box
