export const tokens = {
  "colors": {
    "bg": "#ffffff",
    "bg-surface": "hsl(0, 0%, 97%)",
    "bg-elevated": "hsl(0, 0%, 90%)",
    "text": "#111111",
    "text-subtle": "hsl(0, 0%, 60%)",
    "text-disabled": "hsl(0, 0%, 32%)",
    "destructive": "oklch(0.637 0.237 25.331)"
  },
  "radii": {
    "sm": "8px",
    "md": "12px",
    "lg": "16px",
    "xl": "24px",
    "2xl": "32px",
    "full": "9999px"
  },
  "spacing": {
    "spacing-0": "0px",
    "spacing-1": "8px",
    "spacing-2": "16px",
    "spacing-3": "24px",
    "spacing-4": "32px",
    "spacing-5": "40px",
    "spacing-6": "48px",
    "spacing-8": "64px",
    "spacing-10": "80px",
    "spacing-12": "96px",
    "spacing-16": "128px",
    "spacing-32": "256px"
  },
  "button": {
    "size": {
      "sm": {
        "height": "32px",
        "padding-x": "12px",
        "padding-y": "6px"
      },
      "default": {
        "height": "40px",
        "padding-y": "8px",
        "padding-x": "16px"
      },
      "lg": {
        "height": "48px",
        "padding-x": "20px",
        "padding-y": "16px"
      }
    },
    "primary": {
      "background": "#000000",
      "foreground": "#ffffff"
    },
    "secondary": {
      "background": "oklch(0.967 0.003 264.542)",
      "foreground": "#000000"
    },
    "destructive": {
      "foreground": "#ffffff",
      "background": "oklch(0.637 0.237 25.331)"
    },
    "ghost": {
      "background": "transparent",
      "foreground": "#000000"
    },
    "radius": "8px"
  },
  "card": {
    "footer": {
      "gap": "12px",
      "padding-top": "16px"
    },
    "background": "hsl(0, 0%, 97%)",
    "radius": "16px",
    "gap": "16px",
    "padding": "24px"
  },
  "status": {
    "neutral": {
      "background": "oklch(0.967 0.003 264.542)",
      "foreground": "oklch(0.551 0.027 264.364)"
    },
    "success": {
      "background": "oklch(0.95 0.052 163.051)",
      "foreground": "oklch(0.696 0.17 162.48)"
    },
    "warning": {
      "background": "oklch(0.962 0.059 95.617)",
      "foreground": "oklch(0.769 0.188 70.08)"
    },
    "error": {
      "background": "oklch(0.936 0.032 17.717)",
      "foreground": "oklch(0.637 0.237 25.331)"
    },
    "info": {
      "background": "oklch(0.932 0.032 255.585)",
      "foreground": "oklch(0.623 0.214 259.815)"
    }
  }
} as const

export const themes = {
  "dark": {
    "colors": {
      "bg": "hsl(233, 2%, 3%)",
      "bg-surface": "hsl(233, 2%, 6.5%)",
      "bg-elevated": "hsl(233, 2%, 9.5%)",
      "text": "#f0f0f0",
      "text-subtle": "hsl(233, 2%, 52%)",
      "text-disabled": "hsl(233, 2%, 32%)",
      "destructive": "oklch(0.577 0.245 27.325)"
    },
    "button": {
      "primary": {
        "background": "#ffffff",
        "foreground": "#000000"
      },
      "secondary": {
        "background": "hsl(233, 2%, 12%)",
        "foreground": "#ffffff"
      },
      "ghost": {
        "foreground": "#ffffff"
      }
    },
    "status": {
      "neutral": {
        "background": "hsl(233, 2%, 9.5%)"
      },
      "success": {
        "background": "oklch(0.262 0.051 172.552)"
      },
      "warning": {
        "background": "oklch(0.279 0.077 45.635)"
      },
      "error": {
        "background": "oklch(0.258 0.092 26.042)"
      },
      "info": {
        "background": "oklch(0.282 0.091 267.935)"
      }
    }
  }
} as const
