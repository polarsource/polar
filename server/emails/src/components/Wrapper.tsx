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
            fontFamily="Inter"
            fallbackFontFamily="sans-serif"
            fontWeight="100 900"
            fontStyle="normal"
            webFont={{
              url: 'https://fonts.gstatic.com/s/inter/v19/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2',
              format: 'woff2',
            }}
          />
        </Head>
        <Container className="p-[20px]">{children}</Container>
      </Html>
    </Tailwind>
  )
}

export default Wrapper
