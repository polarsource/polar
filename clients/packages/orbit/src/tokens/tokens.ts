export const tokens = {
  "COLOR_BG": "rgb(255, 255, 255)",
  "COLOR_BG_SURFACE": "hsl(0 0% 97%)",
  "COLOR_BG_ELEVATED": "hsl(0 0% 90%)",
  "COLOR_TEXT": "rgb(17, 17, 17)",
  "COLOR_TEXT_SUBTLE": "hsl(0 0% 60%)",
  "COLOR_TEXT_DISABLED": "hsl(0 0% 32%)",
  "COLOR_DESTRUCTIVE": "oklch(0.637 0.237 25.33)",
  "COLOR_BUTTON_PRIMARY_BG": "rgb(0, 0, 0)",
  "COLOR_BUTTON_PRIMARY_FG": "rgb(255, 255, 255)",
  "COLOR_BUTTON_SECONDARY_BG": "oklch(0.967 0.003 264.54)",
  "COLOR_BUTTON_SECONDARY_FG": "rgb(0, 0, 0)",
  "COLOR_BUTTON_DESTRUCTIVE_FG": "rgb(255, 255, 255)",
  "COLOR_BUTTON_GHOST_BG": "rgb(0, 0, 0 / 0)",
  "COLOR_BUTTON_GHOST_FG": "rgb(0, 0, 0)",
  "COLOR_STATUS_NEUTRAL_BG": "oklch(0.967 0.003 264.54)",
  "COLOR_STATUS_NEUTRAL_FG": "oklch(0.551 0.027 264.36)",
  "COLOR_STATUS_SUCCESS_BG": "oklch(0.95 0.052 163.05)",
  "COLOR_STATUS_SUCCESS_FG": "oklch(0.696 0.17 162.48)",
  "COLOR_STATUS_WARNING_BG": "oklch(0.962 0.059 95.62)",
  "COLOR_STATUS_WARNING_FG": "oklch(0.769 0.188 70.08)",
  "COLOR_STATUS_ERROR_BG": "oklch(0.936 0.032 17.72)",
  "COLOR_STATUS_INFO_BG": "oklch(0.932 0.032 255.59)",
  "COLOR_STATUS_INFO_FG": "oklch(0.623 0.214 259.82)",
  "SPACING_0": "0px",
  "SPACING_1": "6px",
  "SPACING_2": "8px",
  "SPACING_3": "12px",
  "SPACING_4": "16px",
  "SPACING_5": "20px",
  "SPACING_6": "24px",
  "SPACING_7": "32px",
  "SPACING_8": "40px",
  "SPACING_9": "48px",
  "SPACING_10": "64px",
  "SPACING_11": "80px",
  "SPACING_12": "96px",
  "SPACING_13": "128px",
  "SPACING_14": "256px",
  "RADII_SM": "8px",
  "RADII_MD": "12px",
  "RADII_LG": "16px",
  "RADII_XL": "24px",
  "RADII_2XL": "32px",
  "RADII_FULL": "9999px",
  "CARD": {
    "BACKGROUND": "hsl(0 0% 97%)",
    "FOOTER": {
      "GAP": "12px",
      "PADDING_TOP": "16px"
    },
    "GAP": "16px",
    "PADDING": "24px",
    "RADIUS": "16px"
  },
  "BUTTON": {
    "DESTRUCTIVE": {
      "BACKGROUND": "oklch(0.637 0.237 25.33)",
      "FOREGROUND": "rgb(255, 255, 255)"
    },
    "PRIMARY": {
      "BACKGROUND": "rgb(0, 0, 0)",
      "FOREGROUND": "rgb(255, 255, 255)"
    },
    "SECONDARY": {
      "BACKGROUND": "oklch(0.967 0.003 264.54)",
      "FOREGROUND": "rgb(0, 0, 0)"
    },
    "GHOST": {
      "BACKGROUND": "rgb(0, 0, 0 / 0)",
      "FOREGROUND": "rgb(0, 0, 0)"
    },
    "SIZE": {
      "SM": {
        "PADDING_Y": "6px",
        "PADDING_X": "12px",
        "HEIGHT": "32px"
      },
      "DEFAULT": {
        "PADDING_Y": "8px",
        "PADDING_X": "16px",
        "HEIGHT": "40px"
      },
      "LG": {
        "PADDING_Y": "16px",
        "PADDING_X": "20px",
        "HEIGHT": "48px"
      }
    },
    "RADIUS": "8px"
  },
  "STATUS": {
    "ERROR": {
      "FOREGROUND": "oklch(0.637 0.237 25.33)",
      "BACKGROUND": "oklch(0.936 0.032 17.72)"
    },
    "NEUTRAL": {
      "BACKGROUND": "oklch(0.967 0.003 264.54)",
      "FOREGROUND": "oklch(0.551 0.027 264.36)"
    },
    "SUCCESS": {
      "BACKGROUND": "oklch(0.95 0.052 163.05)",
      "FOREGROUND": "oklch(0.696 0.17 162.48)"
    },
    "WARNING": {
      "BACKGROUND": "oklch(0.962 0.059 95.62)",
      "FOREGROUND": "oklch(0.769 0.188 70.08)"
    },
    "INFO": {
      "BACKGROUND": "oklch(0.932 0.032 255.59)",
      "FOREGROUND": "oklch(0.623 0.214 259.82)"
    }
  }
} as const

export const themes = {
  "dark": {
    "COLOR_BG": "hsl(233 2% 3%)",
    "COLOR_BG_SURFACE": "hsl(233 2% 6.5%)",
    "COLOR_BG_ELEVATED": "hsl(233 2% 9.5%)",
    "COLOR_TEXT": "rgb(240, 240, 240)",
    "COLOR_TEXT_SUBTLE": "hsl(233 2% 52%)",
    "COLOR_TEXT_DISABLED": "hsl(233 2% 32%)",
    "COLOR_DESTRUCTIVE": "oklch(0.577 0.245 27.33)",
    "COLOR_BUTTON_PRIMARY_BG": "rgb(255, 255, 255)",
    "COLOR_BUTTON_PRIMARY_FG": "rgb(0, 0, 0)",
    "COLOR_BUTTON_SECONDARY_BG": "hsl(233 2% 12%)",
    "COLOR_BUTTON_SECONDARY_FG": "rgb(255, 255, 255)",
    "COLOR_BUTTON_GHOST_FG": "rgb(255, 255, 255)",
    "COLOR_STATUS_NEUTRAL_BG": "hsl(233 2% 9.5%)",
    "COLOR_STATUS_SUCCESS_BG": "oklch(0.262 0.051 172.55)",
    "COLOR_STATUS_WARNING_BG": "oklch(0.279 0.077 45.64)",
    "COLOR_STATUS_ERROR_BG": "oklch(0.258 0.092 26.04)",
    "COLOR_STATUS_INFO_BG": "oklch(0.282 0.091 267.94)"
  }
} as const
