import { Font, Head, Html, Preview, Tailwind } from 'react-email'

const WrapperBase = ({
  children,
  preview,
}: {
  children: React.ReactNode
  preview?: string
}) => {
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
            fontWeight="400 700"
            fontStyle="normal"
            webFont={{
              url: 'https://fonts.gstatic.com/s/inter/v19/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2',
              format: 'woff2',
            }}
          />
        </Head>
        {preview && <Preview>{preview}</Preview>}
        {children}
      </Html>
    </Tailwind>
  )
}

export default WrapperBase
