import { Container } from 'react-email'
import PolarHeader from './PolarHeader'
import WrapperBase from './WrapperBase'

const WrapperPolar = ({
  children,
  preview,
}: {
  children: React.ReactNode
  preview?: string
}) => {
  return (
    <WrapperBase preview={preview}>
      <Container className="px-[20px] pt-[20px] pb-[10px]">
        <PolarHeader />
      </Container>
      <Container className="px-[20px] pt-[10px] pb-[20px]">
        {children}
      </Container>
    </WrapperBase>
  )
}

export default WrapperPolar
