import { Container, Font, Head, Html, Tailwind } from '@react-email/components'

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#0062FF',
            },
          },
        },
      }}
    >
      <Html lang="en">
        <Head>
          <Font
            fontFamily="sans-serif"
            fallbackFontFamily="sans-serif"
            fontWeight="400"
            fontStyle="normal"
          />
        </Head>
        <Container>{children}</Container>
      </Html>
    </Tailwind>
  )
}

export default Wrapper
