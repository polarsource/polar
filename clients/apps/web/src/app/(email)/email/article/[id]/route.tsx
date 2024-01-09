import EmailRender from '@/components/Feed/Posts/EmailRender'
import PreviewText from '@/components/Feed/Posts/preview'
import { getServerSideAPI } from '@/utils/api'
import { Article } from '@polar-sh/sdk'
import { getMagicLinkAuthenticateURL } from 'polarkit/auth'

import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Row,
  Section,
} from '@react-email/components'
import { render } from '@react-email/render'
import { Tailwind } from '@react-email/tailwind'
import { notFound } from 'next/navigation'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const twConfig = {
  plugins: [require('@tailwindcss/typography')],
  theme: {
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      display: '350',
    },
    extend: {
      backgroundImage: {
        'grid-pattern':
          'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABSSURBVHgB7dihEYBAEATBf/JPEksEOCgEAYw70W3OTp3cvYY5r/v57rGGElYJq4RVwiphlbBKWCWsElYJq4RVwiphlbBKWCWsElbtf/OcZuzHXh9bB88+HN8BAAAAAElFTkSuQmCC")',
        'grid-pattern-dark':
          'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABTSURBVHgB7dihEYBAEATBf9LCEQj5ZwGFIIBxJ7rN2amTu9cw53U/3z3WUMIqYZWwSlglrBJWCauEVcIqYZWwSlglrBJWCauEVcKq/W+e04z92AukgAP/IH2i4wAAAABJRU5ErkJggg==")',
      },
      borderColor: {
        DEFAULT: 'rgb(0 0 0 / 0.07)',
      },
      boxShadow: {
        DEFAULT: `0 0px 15px rgba(0 0 0 / 0.04), 0 0px 2px rgba(0 0 0 / 0.06)`,
        lg: '0 0px 20px rgba(0 0 0 / 0.04), 0 0px 5px rgba(0 0 0 / 0.06)',
        xl: '0 0px 30px rgba(0 0 0 / 0.04), 0 0px 10px rgba(0 0 0 / 0.06)',
        hidden: '0 1px 8px rgb(0 0 0 / 0), 0 0.5px 2.5px rgb(0 0 0 / 0)',
        up: '-2px -2px 22px 0px rgba(61, 84, 171, 0.15)',
      },
      fontFamily: {
        // sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        blue: {
          DEFAULT: '#0062FF',
          50: '#E5EFFF',
          100: '#CCE0FF',
          200: '#99C0FF',
          300: '#66A1FF',
          400: '#3381FF',
          500: '#0062FF',
          600: '#0054DB',
          700: '#0047B8',
          800: '#003994',
          900: '#002B70',
          950: '#00245E',
        },
        gray: {
          50: '#FCFCFD',
          75: '#F8F9FB',
          100: '#F3F4F7',
          200: '#E3E7ED',
          300: '#D0D7E1',
          400: '#A2AEC3',
          500: '#78859B',
          600: '#5F6C81',
          700: '#4A5363',
          800: '#343B46',
          900: '#1E2229',
          950: '#13161A',
        },
        green: {
          50: '#f0faf0',
          100: '#e2f6e3',
          200: '#c5edc6',
          300: '#97de9a',
          400: '#62c667',
          500: '#3fab44',
          600: '#2d8c31',
          700: '#266f29',
          800: '#235826',
          900: '#1e4921',
          950: '#0e2f11',
        },
        red: {
          50: '#fdf3f3',
          100: '#fde3e3',
          200: '#fbcdcd',
          300: '#f8a9a9',
          400: '#f17878',
          500: '#e64d4d',
          600: '#d32f2f',
          700: '#b12424',
          800: '#922222',
          900: '#6f1f1f',
          950: '#420d0d',
        },
        polar: {
          50: '#D2D4DF',
          100: '#C2C4D3',
          200: '#A1A5BB',
          300: '#8186A4',
          400: '#636989',
          500: '#4C5069',
          600: '#343748',
          700: '#1D1E27',
          800: '#16171F',
          900: '#101116',
          950: '#0C0D11',
        },

        // chadcn/ui start
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // chadcn/ui end
      },

      // chadcn/ui start
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // chadcn/ui end
    },
  },
}

const renderArticle = async (
  req: NextRequest,
  articleId: string,
  injectMagicLinkToken?: string,
  unsubscribeLink?: string,
): Promise<NextResponse> => {
  let article: Article

  try {
    article = await getServerSideAPI().articles.get({
      id: articleId,
    })
    if (!article) {
      notFound()
    }
  } catch (e) {
    notFound()
  }

  const post = article

  const date = article.published_at
    ? new Date(article.published_at)
    : new Date()

  const preAuthLink = (path: string): string => {
    if (injectMagicLinkToken) {
      return getMagicLinkAuthenticateURL({
        token: injectMagicLinkToken,
        returnTo: path,
      })
    }
    return `https://polar.sh${path}`
  }

  unsubscribeLink =
    unsubscribeLink ??
    // If we don't have a subscription token. Send user to the subscriptions page.
    preAuthLink(`/${post.organization.name}/subscriptions`)

  const html = render(
    <Html lang="en">
      <Tailwind config={twConfig}>
        <Head />
        <Body className="font-sans">
          {/* "Preview" text. Is showin in email list views in most email readers. */}
          <div
            style={{
              display: 'none',
              overflow: 'hidden',
              lineHeight: '1px',
              opacity: '0',
              maxHeight: '0',
              maxWidth: '0',
            }}
          >
            <PreviewText article={post} />
          </div>
          <Container>
            <Section>
              <Row>
                <Section className="bg-gray-100 p-4">
                  <center>
                    <a
                      href={preAuthLink(
                        `/${post.organization.name}/posts/${post.slug}`,
                      )}
                      target="_blank"
                      className="text-sm text-black"
                    >
                      View this email in your browser
                    </a>
                  </center>
                </Section>
              </Row>

              <Row>
                <Column>
                  <h1>
                    <a
                      href={preAuthLink(
                        `/${post.organization.name}/posts/${post.slug}`,
                      )}
                      target="_blank"
                      className="text-gray-900 no-underline"
                    >
                      {article.title}
                    </a>
                  </h1>
                </Column>
              </Row>
              <Row>
                <Column className="w-full">
                  <Row>
                    <span className="font-medium text-gray-600">
                      {article.byline.name}
                    </span>
                  </Row>
                  <Row>
                    <span className="font-medium text-gray-400">
                      {date
                        .toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                        .toUpperCase()}
                    </span>
                  </Row>
                </Column>
                <Column>
                  <Img
                    className="h-10 w-10 rounded-full"
                    src={article.byline.avatar_url}
                  />
                </Column>
              </Row>

              <Hr />

              <Row>
                <Column className="prose dark:prose-invert dark:prose-headings:text-white prose-p:text-gray-700 prose-img:rounded-2xl dark:prose-p:text-polar-200 prose-a:text-blue-500 hover:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-a:text-blue-400 prose-a:no-underline mb-8 space-y-16">
                  <EmailRender article={article} />
                </Column>
              </Row>

              <hr />

              <center className="py-3 pt-3 text-xs text-gray-500">
                You received this email because you&apos;re a subscriber to{' '}
                <a
                  href={preAuthLink(`/${post.organization.name}`)}
                  target="_blank"
                  className="!underline underline-offset-1"
                >
                  {post.organization.pretty_name || post.organization.name}
                </a>
                . Thanks!
              </center>

              <center className="py-3  text-xs text-gray-500">
                <a
                  href={unsubscribeLink}
                  target="_blank"
                  className="!underline underline-offset-1"
                >
                  Unsubscribe
                </a>
              </center>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
    {
      pretty: true,
    },
  )

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: { id: string }
  },
): Promise<NextResponse> {
  return renderArticle(req, params.id)
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: { id: string }
  },
): Promise<NextResponse> {
  const input = await req.json()

  const injectMagicLinkToken = input
    ? input['inject_magic_link_token']
    : undefined

  const unsubscribeLink = input ? input['unsubscribe_link'] : undefined

  return renderArticle(req, params.id, injectMagicLinkToken, unsubscribeLink)
}
