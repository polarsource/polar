import { Container, Preview } from 'react-email'
import PolarHeader from '../PolarHeader'
import WrapperBase from '../WrapperBase'

interface WrapperPolarProps {
  children: React.ReactNode
  preview?: string
}

const WrapperPolar = ({ children, preview }: WrapperPolarProps) => {
  return (
    <WrapperBase>
      {preview ? <Preview>{preview}</Preview> : null}
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
