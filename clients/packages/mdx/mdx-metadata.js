import { name as isIdentifierName } from 'estree-util-is-identifier-name'
import { valueToEstree } from 'estree-util-value-to-estree'
import { parse as parseToml } from 'toml'
import { parse as parseYaml } from 'yaml'

/**
 * A remark plugin to expose frontmatter data as named exports.
 *
 * @param options Optional options to configure the output.
 * @returns A unified transformer.
 */
const remarkMdxFrontmatter =
  (opengraphImageUrl) =>
  ({ name = 'metadata', parsers } = {}) => {
    if (!isIdentifierName(name)) {
      throw new Error(
        `Name should be a valid identifier, got: ${JSON.stringify(name)}`,
      )
    }

    const allParsers = {
      yaml: parseYaml,
      toml: parseToml,
      ...parsers,
    }

    return (ast) => {
      let data
      const node = ast.children.find((child) =>
        Object.hasOwn(allParsers, child.type),
      )

      if (node) {
        const parser = allParsers[node.type]

        const { value } = node

        data = {
          ...parser(value),
        }

        const openGraph = {
          type: 'website',
          ...(opengraphImageUrl
            ? {
                images: [
                  {
                    url: `${opengraphImageUrl}?${new URLSearchParams(data).toString()}`,
                    width: 1200,
                    height: 630,
                  },
                ],
              }
            : {}),
        }

        data.openGraph = {
          ...openGraph,
          ...data.openGraph,
        }
      }

      ast.children.unshift({
        type: 'mdxjsEsm',
        value: '',
        data: {
          estree: {
            type: 'Program',
            sourceType: 'module',
            body: [
              {
                type: 'ExportNamedDeclaration',
                specifiers: [],
                declaration: {
                  type: 'VariableDeclaration',
                  kind: 'const',
                  declarations: [
                    {
                      type: 'VariableDeclarator',
                      id: { type: 'Identifier', name },
                      init: valueToEstree(data, { preserveReferences: true }),
                    },
                  ],
                },
              },
            ],
          },
        },
      })
    }
  }

export default remarkMdxFrontmatter
