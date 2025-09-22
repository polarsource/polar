// Only load languages that are actually used in the codebase
export const USED_LANGUAGES = ['javascript', 'bash']

export const themesList = ['catppuccin-latte', 'poimandres']
export const themeConfig = {
  light: 'catppuccin-latte',
  dark: 'poimandres',
}

export const transformers = [
  {
    pre(node) {
      node.properties.style = node.properties.style
        ?.toString()
        .replace(/background-color:#\w+;/, '')
    },
  },
]
