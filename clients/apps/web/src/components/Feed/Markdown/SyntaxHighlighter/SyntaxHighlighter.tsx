/**
 * Taken from @react-email/code-block
 * https://github.com/resend/react-email/tree/canary/packages/code-block/src
 */
import Prism from 'prismjs'

import './languages'
import { Theme } from './themes'

const stylesForToken = (token: Prism.Token, theme: Theme) => {
  let styles = { ...theme[token.type] }

  const aliases = Array.isArray(token.alias) ? token.alias : [token.alias]

  for (const alias of aliases) {
    styles = { ...styles, ...theme[alias] }
  }

  return styles
}

const CodeBlockLine = ({
  token,
  theme,
  inheritedStyles,
}: {
  token: string | Prism.Token
  theme: Theme
  inheritedStyles?: React.CSSProperties
}) => {
  if (token instanceof Prism.Token) {
    const styleForToken = {
      ...inheritedStyles,
      ...stylesForToken(token, theme),
    }

    if (token.content instanceof Prism.Token) {
      return (
        <span style={styleForToken}>
          <CodeBlockLine theme={theme} token={token.content} />
        </span>
      )
    } else if (typeof token.content === 'string') {
      return <span style={styleForToken}>{token.content}</span>
    }
    return (
      <>
        {token.content.map((subToken, i) => (
          <CodeBlockLine
            inheritedStyles={styleForToken}
            key={i}
            theme={theme}
            token={subToken}
          />
        ))}
      </>
    )
  }

  return <span style={inheritedStyles}>{token}</span>
}

const SyntaxHighlighter = (props: {
  language: string | undefined
  code: string
  theme: Theme
}) => {
  const { language, code, theme } = props

  const resolvedLanguage =
    language && Prism.languages[language] ? language : 'plain'
  const languageGrammar = Prism.languages[resolvedLanguage]
  const lines = code.split(/\r?\n/) ?? []
  const tokensPerLine = lines.map((line) =>
    Prism.tokenize(line, languageGrammar),
  )

  const width = Math.log10(tokensPerLine.length) * 10

  return (
    <pre style={{ ...theme.base }}>
      <code>
        {tokensPerLine.map((tokensForLine, lineIndex) => (
          <div key={lineIndex} className="m-0">
            <span
              style={{
                marginRight: '1.5rem',
                opacity: '.2',
                fontSize: '.7rem',
                userSelect: 'none',
                textAlign: 'right',
                display: 'inline-block',
                width: `${width}px`,
              }}
            >
              {lineIndex + 1}
            </span>
            {tokensForLine.map((token, i) => (
              <CodeBlockLine key={i} theme={theme} token={token} />
            ))}
          </div>
        ))}
      </code>
    </pre>
  )
}

export default SyntaxHighlighter
