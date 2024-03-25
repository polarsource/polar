import { MarkdownToJSX } from 'markdown-to-jsx'
import React from 'react'

type RenderRuleType = (
  next: () => React.ReactChild,
  node: MarkdownToJSX.ParserResult,
  renderChildren: MarkdownToJSX.RuleOutput,
  state: MarkdownToJSX.State,
) => React.ReactChild

const RuleType = {
  blockQuote: '0',
  paragraph: '21',
  text: '27',
  breakLine: '1',
}

const isBlockquote = (
  node: MarkdownToJSX.ParserResult,
): node is MarkdownToJSX.BlockQuoteNode => node.type === RuleType.blockQuote

const isParagraph = (
  node: MarkdownToJSX.ParserResult,
): node is MarkdownToJSX.ParagraphNode => node.type === RuleType.paragraph

const isText = (
  node: MarkdownToJSX.ParserResult,
): node is MarkdownToJSX.TextNode => node.type === RuleType.text

const CALLOUT_HEADER_REGEX = /\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i

export enum CalloutType {
  NOTE = 'NOTE',
  TIP = 'TIP',
  IMPORTANT = 'IMPORTANT',
  WARNING = 'WARNING',
  CAUTION = 'CAUTION',
}

export const CALLOUT_TYPE_BORDER_COLORS: Record<CalloutType, string> = {
  [CalloutType.NOTE]: 'border-blue-500',
  [CalloutType.TIP]: 'border-green-500',
  [CalloutType.IMPORTANT]: 'border-violet-500',
  [CalloutType.WARNING]: 'border-yellow-500',
  [CalloutType.CAUTION]: 'border-red-500',
}

export const CALLOUT_TYPE_TEXT_COLORS: Record<CalloutType, string> = {
  [CalloutType.NOTE]: 'text-blue-500',
  [CalloutType.TIP]: 'text-green-500',
  [CalloutType.IMPORTANT]: 'text-violet-500',
  [CalloutType.WARNING]: 'text-yellow-500',
  [CalloutType.CAUTION]: 'text-red-500',
}

export interface CalloutProps {
  type: CalloutType
  children: React.ReactNode
}

export const calloutRenderRule =
  (renderer: React.FC<CalloutProps>): RenderRuleType =>
  // eslint-disable-next-line react/display-name
  (next, node, renderChildren, state) => {
    if (isBlockquote(node)) {
      const paragraphIndex = node.children.findIndex(isParagraph)
      if (paragraphIndex > -1) {
        const paragraph = node.children[
          paragraphIndex
        ] as MarkdownToJSX.ParagraphNode
        let header = ''
        let i = 0
        for (const child of paragraph.children) {
          if (isText(child)) {
            header += child.text
            i++
          } else {
            if (child.type === RuleType.breakLine) {
              i++
            }
            break
          }
        }
        const headerMatch = header.match(CALLOUT_HEADER_REGEX)
        if (headerMatch) {
          const calloutType = headerMatch[1] as CalloutType
          const updatedChildren = [
            ...node.children.slice(0, paragraphIndex),
            {
              ...paragraph,
              children: [
                {
                  type: RuleType.text,
                  key: `${state.key}-text`,
                  text: header.replace(CALLOUT_HEADER_REGEX, ''),
                } as MarkdownToJSX.TextNode,
                ...paragraph.children.slice(i),
              ],
            },
            ...node.children.slice(paragraphIndex + 1),
          ]
          return (
            <React.Fragment key={state.key}>
              {renderer({
                type: calloutType,
                children: updatedChildren.map((child, index) => (
                  <React.Fragment key={`${state.key}-${index}`}>
                    {renderChildren(child, state)}
                  </React.Fragment>
                )),
              })}
            </React.Fragment>
          )
        }
      }
    }

    return next()
  }
