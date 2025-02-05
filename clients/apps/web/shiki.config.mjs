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
