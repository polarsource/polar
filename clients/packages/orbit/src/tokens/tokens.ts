export const tokens = {
  "COLORS": {
    "BG": "#ffffff",
    "BG_SURFACE": "hsl(0, 0%, 97%)",
    "BG_ELEVATED": "hsl(0, 0%, 90%)",
    "TEXT": "#111111",
    "TEXT_SUBTLE": "hsl(0, 0%, 60%)",
    "TEXT_DISABLED": "hsl(0, 0%, 32%)",
    "DESTRUCTIVE": "oklch(0.637 0.237 25.331)"
  },
  "SPACING": {
    "SPACING_0": "0px",
    "SPACING_1": "8px",
    "SPACING_2": "16px",
    "SPACING_3": "24px",
    "SPACING_4": "32px",
    "SPACING_5": "40px",
    "SPACING_6": "48px",
    "SPACING_8": "64px",
    "SPACING_10": "80px",
    "SPACING_12": "96px",
    "SPACING_16": "128px",
    "SPACING_32": "256px"
  },
  "RADII": {
    "SM": "8px",
    "MD": "12px",
    "LG": "16px",
    "XL": "24px",
    "2XL": "32px",
    "FULL": "9999px"
  },
  "BUTTON": {
    "SIZE": {
      "SM": {
        "HEIGHT": "32px",
        "PADDING_X": "12px",
        "PADDING_Y": "6px"
      },
      "DEFAULT": {
        "HEIGHT": "40px",
        "PADDING_Y": "8px",
        "PADDING_X": "16px"
      },
      "LG": {
        "HEIGHT": "48px",
        "PADDING_X": "20px",
        "PADDING_Y": "16px"
      }
    },
    "PRIMARY": {
      "BACKGROUND": "#000000",
      "FOREGROUND": "#ffffff"
    },
    "SECONDARY": {
      "BACKGROUND": "oklch(0.967 0.003 264.542)",
      "FOREGROUND": "#000000"
    },
    "DESTRUCTIVE": {
      "FOREGROUND": "#ffffff",
      "BACKGROUND": "oklch(0.637 0.237 25.331)"
    },
    "GHOST": {
      "BACKGROUND": "transparent",
      "FOREGROUND": "#000000"
    },
    "RADIUS": "8px"
  },
  "CARD": {
    "FOOTER": {
      "GAP": "12px",
      "PADDING_TOP": "16px"
    },
    "BACKGROUND": "hsl(0, 0%, 97%)",
    "GAP": "16px",
    "PADDING": "24px",
    "RADIUS": "16px"
  },
  "STATUS": {
    "NEUTRAL": {
      "BACKGROUND": "oklch(0.967 0.003 264.542)",
      "FOREGROUND": "oklch(0.551 0.027 264.364)"
    },
    "SUCCESS": {
      "BACKGROUND": "oklch(0.95 0.052 163.051)",
      "FOREGROUND": "oklch(0.696 0.17 162.48)"
    },
    "WARNING": {
      "BACKGROUND": "oklch(0.962 0.059 95.617)",
      "FOREGROUND": "oklch(0.769 0.188 70.08)"
    },
    "ERROR": {
      "BACKGROUND": "oklch(0.936 0.032 17.717)",
      "FOREGROUND": "oklch(0.637 0.237 25.331)"
    },
    "INFO": {
      "BACKGROUND": "oklch(0.932 0.032 255.585)",
      "FOREGROUND": "oklch(0.623 0.214 259.815)"
    }
  }
} as const

export const themes = {
  "dark": {
    "COLORS": {
      "BG": "hsl(233, 2%, 3%)",
      "BG_SURFACE": "hsl(233, 2%, 6.5%)",
      "BG_ELEVATED": "hsl(233, 2%, 9.5%)",
      "TEXT": "#f0f0f0",
      "TEXT_SUBTLE": "hsl(233, 2%, 52%)",
      "TEXT_DISABLED": "hsl(233, 2%, 32%)",
      "DESTRUCTIVE": "oklch(0.577 0.245 27.325)"
    },
    "BUTTON": {
      "PRIMARY": {
        "BACKGROUND": "#ffffff",
        "FOREGROUND": "#000000"
      },
      "SECONDARY": {
        "BACKGROUND": "hsl(233, 2%, 12%)",
        "FOREGROUND": "#ffffff"
      },
      "GHOST": {
        "FOREGROUND": "#ffffff"
      }
    },
    "STATUS": {
      "NEUTRAL": {
        "BACKGROUND": "hsl(233, 2%, 9.5%)"
      },
      "SUCCESS": {
        "BACKGROUND": "oklch(0.262 0.051 172.552)"
      },
      "WARNING": {
        "BACKGROUND": "oklch(0.279 0.077 45.635)"
      },
      "ERROR": {
        "BACKGROUND": "oklch(0.258 0.092 26.042)"
      },
      "INFO": {
        "BACKGROUND": "oklch(0.282 0.091 267.935)"
      }
    }
  }
} as const
