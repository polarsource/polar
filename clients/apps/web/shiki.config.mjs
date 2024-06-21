export const themesList = ['catppuccin-latte', 'catppuccin-mocha']
export const themeConfig = {
  light: 'catppuccin-latte',
  dark: 'catppuccin-mocha',
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
