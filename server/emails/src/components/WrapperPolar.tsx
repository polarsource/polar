import { Container } from '@react-email/components'
import PolarHeader from './PolarHeader'
import WrapperBase from './WrapperBase'

const WrapperPolar = ({ children }: { children: React.ReactNode }) => {
  return (
    <WrapperBase>
      <Container className="px-[12px] pt-[20px] pb-[10px]">
        <PolarHeader />
      </Container>
      <Container className="px-[20px] pt-[10px] pb-[20px]">
        {children}
      </Container>
    </WrapperBase>
  )
}

export default WrapperPolar
