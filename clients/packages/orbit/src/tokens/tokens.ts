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

export const tokenDefinitions = {
  "COLOR_BG": {
    "rawPath": [
      "COLOR_BG"
    ],
    "value": "rgb(255, 255, 255)",
    "type": "color",
    "category": "design",
    "description": "Page background — the outermost canvas.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 3%)"
      }
    }
  },
  "COLOR_BG_SURFACE": {
    "rawPath": [
      "COLOR_BG_SURFACE"
    ],
    "value": "hsl(0 0% 97%)",
    "type": "color",
    "category": "design",
    "description": "Surface background — cards, panels, and containers elevated above the page background.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 6.5%)"
      }
    }
  },
  "COLOR_BG_ELEVATED": {
    "rawPath": [
      "COLOR_BG_ELEVATED"
    ],
    "value": "hsl(0 0% 90%)",
    "type": "color",
    "category": "design",
    "description": "Elevated surface — popovers, dropdowns, tooltips, and floating layers above a surface.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 9.5%)"
      }
    }
  },
  "COLOR_TEXT": {
    "rawPath": [
      "COLOR_TEXT"
    ],
    "value": "rgb(17, 17, 17)",
    "type": "color",
    "category": "design",
    "description": "Primary text color.",
    "themeValues": {
      "dark": {
        "value": "rgb(240, 240, 240)"
      }
    }
  },
  "COLOR_TEXT_SUBTLE": {
    "rawPath": [
      "COLOR_TEXT_SUBTLE"
    ],
    "value": "hsl(0 0% 60%)",
    "type": "color",
    "category": "design",
    "description": "Secondary and muted text — labels, captions, supporting copy.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 52%)"
      }
    }
  },
  "COLOR_TEXT_DISABLED": {
    "rawPath": [
      "COLOR_TEXT_DISABLED"
    ],
    "value": "hsl(0 0% 32%)",
    "type": "color",
    "category": "design",
    "description": "Disabled and placeholder text — conveys non-interactive state.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 32%)"
      }
    }
  },
  "COLOR_DESTRUCTIVE": {
    "rawPath": [
      "COLOR_DESTRUCTIVE"
    ],
    "value": "oklch(0.637 0.237 25.33)",
    "type": "color",
    "category": "design",
    "description": "Destructive-action color (red-500). Used for delete, remove, and irreversible operations.",
    "themeValues": {
      "dark": {
        "value": "oklch(0.577 0.245 27.33)"
      }
    }
  },
  "COLOR_BUTTON_PRIMARY_BG": {
    "rawPath": [
      "COLOR_BUTTON_PRIMARY_BG"
    ],
    "value": "rgb(0, 0, 0)",
    "type": "color",
    "category": "design",
    "description": "Primary button background.",
    "themeValues": {
      "dark": {
        "value": "rgb(255, 255, 255)"
      }
    }
  },
  "COLOR_BUTTON_PRIMARY_FG": {
    "rawPath": [
      "COLOR_BUTTON_PRIMARY_FG"
    ],
    "value": "rgb(255, 255, 255)",
    "type": "color",
    "category": "design",
    "description": "Primary button foreground.",
    "themeValues": {
      "dark": {
        "value": "rgb(0, 0, 0)"
      }
    }
  },
  "COLOR_BUTTON_SECONDARY_BG": {
    "rawPath": [
      "COLOR_BUTTON_SECONDARY_BG"
    ],
    "value": "oklch(0.967 0.003 264.54)",
    "type": "color",
    "category": "design",
    "description": "Secondary button background.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 12%)"
      }
    }
  },
  "COLOR_BUTTON_SECONDARY_FG": {
    "rawPath": [
      "COLOR_BUTTON_SECONDARY_FG"
    ],
    "value": "rgb(0, 0, 0)",
    "type": "color",
    "category": "design",
    "description": "Secondary button foreground.",
    "themeValues": {
      "dark": {
        "value": "rgb(255, 255, 255)"
      }
    }
  },
  "COLOR_BUTTON_DESTRUCTIVE_FG": {
    "rawPath": [
      "COLOR_BUTTON_DESTRUCTIVE_FG"
    ],
    "value": "rgb(255, 255, 255)",
    "type": "color",
    "category": "design",
    "description": "Destructive button foreground."
  },
  "COLOR_BUTTON_GHOST_BG": {
    "rawPath": [
      "COLOR_BUTTON_GHOST_BG"
    ],
    "value": "rgb(0, 0, 0 / 0)",
    "type": "color",
    "category": "design",
    "description": "Ghost button background."
  },
  "COLOR_BUTTON_GHOST_FG": {
    "rawPath": [
      "COLOR_BUTTON_GHOST_FG"
    ],
    "value": "rgb(0, 0, 0)",
    "type": "color",
    "category": "design",
    "description": "Ghost button foreground.",
    "themeValues": {
      "dark": {
        "value": "rgb(255, 255, 255)"
      }
    }
  },
  "COLOR_STATUS_NEUTRAL_BG": {
    "rawPath": [
      "COLOR_STATUS_NEUTRAL_BG"
    ],
    "value": "oklch(0.967 0.003 264.54)",
    "type": "color",
    "category": "design",
    "description": "Neutral status background.",
    "themeValues": {
      "dark": {
        "value": "hsl(233 2% 9.5%)"
      }
    }
  },
  "COLOR_STATUS_NEUTRAL_FG": {
    "rawPath": [
      "COLOR_STATUS_NEUTRAL_FG"
    ],
    "value": "oklch(0.551 0.027 264.36)",
    "type": "color",
    "category": "design",
    "description": "Neutral status foreground."
  },
  "COLOR_STATUS_SUCCESS_BG": {
    "rawPath": [
      "COLOR_STATUS_SUCCESS_BG"
    ],
    "value": "oklch(0.95 0.052 163.05)",
    "type": "color",
    "category": "design",
    "description": "Success status background.",
    "themeValues": {
      "dark": {
        "value": "oklch(0.262 0.051 172.55)"
      }
    }
  },
  "COLOR_STATUS_SUCCESS_FG": {
    "rawPath": [
      "COLOR_STATUS_SUCCESS_FG"
    ],
    "value": "oklch(0.696 0.17 162.48)",
    "type": "color",
    "category": "design",
    "description": "Success status foreground."
  },
  "COLOR_STATUS_WARNING_BG": {
    "rawPath": [
      "COLOR_STATUS_WARNING_BG"
    ],
    "value": "oklch(0.962 0.059 95.62)",
    "type": "color",
    "category": "design",
    "description": "Warning status background.",
    "themeValues": {
      "dark": {
        "value": "oklch(0.279 0.077 45.64)"
      }
    }
  },
  "COLOR_STATUS_WARNING_FG": {
    "rawPath": [
      "COLOR_STATUS_WARNING_FG"
    ],
    "value": "oklch(0.769 0.188 70.08)",
    "type": "color",
    "category": "design",
    "description": "Warning status foreground."
  },
  "COLOR_STATUS_ERROR_BG": {
    "rawPath": [
      "COLOR_STATUS_ERROR_BG"
    ],
    "value": "oklch(0.936 0.032 17.72)",
    "type": "color",
    "category": "design",
    "description": "Error status background.",
    "themeValues": {
      "dark": {
        "value": "oklch(0.258 0.092 26.04)"
      }
    }
  },
  "COLOR_STATUS_INFO_BG": {
    "rawPath": [
      "COLOR_STATUS_INFO_BG"
    ],
    "value": "oklch(0.932 0.032 255.59)",
    "type": "color",
    "category": "design",
    "description": "Info status background.",
    "themeValues": {
      "dark": {
        "value": "oklch(0.282 0.091 267.94)"
      }
    }
  },
  "COLOR_STATUS_INFO_FG": {
    "rawPath": [
      "COLOR_STATUS_INFO_FG"
    ],
    "value": "oklch(0.623 0.214 259.82)",
    "type": "color",
    "category": "design",
    "description": "Info status foreground."
  },
  "SPACING_0": {
    "rawPath": [
      "SPACING_0"
    ],
    "value": "0px",
    "type": "dimension",
    "category": "design",
    "description": "No spacing — zero gap."
  },
  "SPACING_1": {
    "rawPath": [
      "SPACING_1"
    ],
    "value": "6px",
    "type": "dimension",
    "category": "design",
    "description": "Tight — 6 px. Compact vertical control padding."
  },
  "SPACING_2": {
    "rawPath": [
      "SPACING_2"
    ],
    "value": "8px",
    "type": "dimension",
    "category": "design",
    "description": "Extra-small — 8 px. Tight gutters and icon padding."
  },
  "SPACING_3": {
    "rawPath": [
      "SPACING_3"
    ],
    "value": "12px",
    "type": "dimension",
    "category": "design",
    "description": "Small — 12 px. Compact control gutters."
  },
  "SPACING_4": {
    "rawPath": [
      "SPACING_4"
    ],
    "value": "16px",
    "type": "dimension",
    "category": "design",
    "description": "Base — 16 px. Default component padding and inline gaps."
  },
  "SPACING_5": {
    "rawPath": [
      "SPACING_5"
    ],
    "value": "20px",
    "type": "dimension",
    "category": "design",
    "description": "Medium-small — 20 px. Large control horizontal padding."
  },
  "SPACING_6": {
    "rawPath": [
      "SPACING_6"
    ],
    "value": "24px",
    "type": "dimension",
    "category": "design",
    "description": "Medium — 24 px. Card padding and section gaps."
  },
  "SPACING_7": {
    "rawPath": [
      "SPACING_7"
    ],
    "value": "32px",
    "type": "dimension",
    "category": "design",
    "description": "Large — 32 px. Panel padding and block separation."
  },
  "SPACING_8": {
    "rawPath": [
      "SPACING_8"
    ],
    "value": "40px",
    "type": "dimension",
    "category": "design",
    "description": "Extra-large — 40 px."
  },
  "SPACING_9": {
    "rawPath": [
      "SPACING_9"
    ],
    "value": "48px",
    "type": "dimension",
    "category": "design",
    "description": "2x large — 48 px. Generous section padding."
  },
  "SPACING_10": {
    "rawPath": [
      "SPACING_10"
    ],
    "value": "64px",
    "type": "dimension",
    "category": "design",
    "description": "3x large — 64 px. Wide layout gutters."
  },
  "SPACING_11": {
    "rawPath": [
      "SPACING_11"
    ],
    "value": "80px",
    "type": "dimension",
    "category": "design",
    "description": "4x large — 80 px."
  },
  "SPACING_12": {
    "rawPath": [
      "SPACING_12"
    ],
    "value": "96px",
    "type": "dimension",
    "category": "design",
    "description": "5x large — 96 px."
  },
  "SPACING_13": {
    "rawPath": [
      "SPACING_13"
    ],
    "value": "128px",
    "type": "dimension",
    "category": "design",
    "description": "6x large — 128 px. Page-level vertical rhythm."
  },
  "SPACING_14": {
    "rawPath": [
      "SPACING_14"
    ],
    "value": "256px",
    "type": "dimension",
    "category": "design",
    "description": "Maximum — 256 px. Full-bleed hero spacing."
  },
  "RADII_SM": {
    "rawPath": [
      "RADII_SM"
    ],
    "value": "8px",
    "type": "dimension",
    "category": "design",
    "description": "Small radius (rounded-lg). Buttons, badges, inputs."
  },
  "RADII_MD": {
    "rawPath": [
      "RADII_MD"
    ],
    "value": "12px",
    "type": "dimension",
    "category": "design",
    "description": "Medium radius (rounded-xl). Form controls and small cards."
  },
  "RADII_LG": {
    "rawPath": [
      "RADII_LG"
    ],
    "value": "16px",
    "type": "dimension",
    "category": "design",
    "description": "Large radius (rounded-2xl). Cards and panels."
  },
  "RADII_XL": {
    "rawPath": [
      "RADII_XL"
    ],
    "value": "24px",
    "type": "dimension",
    "category": "design",
    "description": "Extra-large radius (rounded-3xl). Modals and drawers."
  },
  "RADII_2XL": {
    "rawPath": [
      "RADII_2XL"
    ],
    "value": "32px",
    "type": "dimension",
    "category": "design",
    "description": "2x large radius (rounded-4xl). Hero surfaces and banners."
  },
  "RADII_FULL": {
    "rawPath": [
      "RADII_FULL"
    ],
    "value": "9999px",
    "type": "dimension",
    "category": "design",
    "description": "Fully rounded — pill shape for avatars and tags."
  },
  "CARD_BACKGROUND": {
    "rawPath": [
      "CARD",
      "BACKGROUND"
    ],
    "value": "hsl(0 0% 97%)",
    "aliasOf": "COLOR_BG_SURFACE",
    "type": "color",
    "category": "component",
    "description": "Card background color — sits one step above the page background."
  },
  "BUTTON_DESTRUCTIVE_BACKGROUND": {
    "rawPath": [
      "BUTTON",
      "DESTRUCTIVE",
      "BACKGROUND"
    ],
    "value": "oklch(0.637 0.237 25.33)",
    "aliasOf": "COLOR_DESTRUCTIVE",
    "type": "color",
    "category": "component",
    "description": "Destructive button fill (red-500 / red-600 in dark)."
  },
  "STATUS_ERROR_FOREGROUND": {
    "rawPath": [
      "STATUS",
      "ERROR",
      "FOREGROUND"
    ],
    "value": "oklch(0.637 0.237 25.33)",
    "aliasOf": "COLOR_DESTRUCTIVE",
    "type": "color",
    "category": "component",
    "description": "Error status text (red-500 / red-600 in dark)."
  },
  "BUTTON_PRIMARY_BACKGROUND": {
    "rawPath": [
      "BUTTON",
      "PRIMARY",
      "BACKGROUND"
    ],
    "value": "rgb(0, 0, 0)",
    "aliasOf": "COLOR_BUTTON_PRIMARY_BG",
    "type": "color",
    "category": "component",
    "description": "Primary button fill."
  },
  "BUTTON_PRIMARY_FOREGROUND": {
    "rawPath": [
      "BUTTON",
      "PRIMARY",
      "FOREGROUND"
    ],
    "value": "rgb(255, 255, 255)",
    "aliasOf": "COLOR_BUTTON_PRIMARY_FG",
    "type": "color",
    "category": "component",
    "description": "Primary button label and icon color."
  },
  "BUTTON_SECONDARY_BACKGROUND": {
    "rawPath": [
      "BUTTON",
      "SECONDARY",
      "BACKGROUND"
    ],
    "value": "oklch(0.967 0.003 264.54)",
    "aliasOf": "COLOR_BUTTON_SECONDARY_BG",
    "type": "color",
    "category": "component",
    "description": "Secondary button fill (gray-100)."
  },
  "BUTTON_SECONDARY_FOREGROUND": {
    "rawPath": [
      "BUTTON",
      "SECONDARY",
      "FOREGROUND"
    ],
    "value": "rgb(0, 0, 0)",
    "aliasOf": "COLOR_BUTTON_SECONDARY_FG",
    "type": "color",
    "category": "component",
    "description": "Secondary button label color."
  },
  "BUTTON_DESTRUCTIVE_FOREGROUND": {
    "rawPath": [
      "BUTTON",
      "DESTRUCTIVE",
      "FOREGROUND"
    ],
    "value": "rgb(255, 255, 255)",
    "aliasOf": "COLOR_BUTTON_DESTRUCTIVE_FG",
    "type": "color",
    "category": "component",
    "description": "Destructive button label color."
  },
  "BUTTON_GHOST_BACKGROUND": {
    "rawPath": [
      "BUTTON",
      "GHOST",
      "BACKGROUND"
    ],
    "value": "rgb(0, 0, 0 / 0)",
    "aliasOf": "COLOR_BUTTON_GHOST_BG",
    "type": "color",
    "category": "component",
    "description": "Ghost button has no fill at rest."
  },
  "BUTTON_GHOST_FOREGROUND": {
    "rawPath": [
      "BUTTON",
      "GHOST",
      "FOREGROUND"
    ],
    "value": "rgb(0, 0, 0)",
    "aliasOf": "COLOR_BUTTON_GHOST_FG",
    "type": "color",
    "category": "component",
    "description": "Ghost button label color."
  },
  "STATUS_NEUTRAL_BACKGROUND": {
    "rawPath": [
      "STATUS",
      "NEUTRAL",
      "BACKGROUND"
    ],
    "value": "oklch(0.967 0.003 264.54)",
    "aliasOf": "COLOR_STATUS_NEUTRAL_BG",
    "type": "color",
    "category": "component",
    "description": "Neutral status background (gray-100)."
  },
  "STATUS_NEUTRAL_FOREGROUND": {
    "rawPath": [
      "STATUS",
      "NEUTRAL",
      "FOREGROUND"
    ],
    "value": "oklch(0.551 0.027 264.36)",
    "aliasOf": "COLOR_STATUS_NEUTRAL_FG",
    "type": "color",
    "category": "component",
    "description": "Neutral status text (gray-500)."
  },
  "STATUS_SUCCESS_BACKGROUND": {
    "rawPath": [
      "STATUS",
      "SUCCESS",
      "BACKGROUND"
    ],
    "value": "oklch(0.95 0.052 163.05)",
    "aliasOf": "COLOR_STATUS_SUCCESS_BG",
    "type": "color",
    "category": "component",
    "description": "Success status background (emerald-100)."
  },
  "STATUS_SUCCESS_FOREGROUND": {
    "rawPath": [
      "STATUS",
      "SUCCESS",
      "FOREGROUND"
    ],
    "value": "oklch(0.696 0.17 162.48)",
    "aliasOf": "COLOR_STATUS_SUCCESS_FG",
    "type": "color",
    "category": "component",
    "description": "Success status text (emerald-500)."
  },
  "STATUS_WARNING_BACKGROUND": {
    "rawPath": [
      "STATUS",
      "WARNING",
      "BACKGROUND"
    ],
    "value": "oklch(0.962 0.059 95.62)",
    "aliasOf": "COLOR_STATUS_WARNING_BG",
    "type": "color",
    "category": "component",
    "description": "Warning status background (amber-100)."
  },
  "STATUS_WARNING_FOREGROUND": {
    "rawPath": [
      "STATUS",
      "WARNING",
      "FOREGROUND"
    ],
    "value": "oklch(0.769 0.188 70.08)",
    "aliasOf": "COLOR_STATUS_WARNING_FG",
    "type": "color",
    "category": "component",
    "description": "Warning status text (amber-500)."
  },
  "STATUS_ERROR_BACKGROUND": {
    "rawPath": [
      "STATUS",
      "ERROR",
      "BACKGROUND"
    ],
    "value": "oklch(0.936 0.032 17.72)",
    "aliasOf": "COLOR_STATUS_ERROR_BG",
    "type": "color",
    "category": "component",
    "description": "Error status background (red-100)."
  },
  "STATUS_INFO_BACKGROUND": {
    "rawPath": [
      "STATUS",
      "INFO",
      "BACKGROUND"
    ],
    "value": "oklch(0.932 0.032 255.59)",
    "aliasOf": "COLOR_STATUS_INFO_BG",
    "type": "color",
    "category": "component",
    "description": "Info status background (blue-100)."
  },
  "STATUS_INFO_FOREGROUND": {
    "rawPath": [
      "STATUS",
      "INFO",
      "FOREGROUND"
    ],
    "value": "oklch(0.623 0.214 259.82)",
    "aliasOf": "COLOR_STATUS_INFO_FG",
    "type": "color",
    "category": "component",
    "description": "Info status text (blue-500)."
  },
  "BUTTON_SIZE_SM_PADDING_Y": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "SM",
      "PADDING_Y"
    ],
    "value": "6px",
    "aliasOf": "SPACING_1",
    "type": "dimension",
    "category": "component",
    "description": "Small button vertical padding — 6 px (py-1.5)."
  },
  "BUTTON_SIZE_DEFAULT_PADDING_Y": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "DEFAULT",
      "PADDING_Y"
    ],
    "value": "8px",
    "aliasOf": "SPACING_2",
    "type": "dimension",
    "category": "component",
    "description": "Default button vertical padding — 8 px (py-2)."
  },
  "BUTTON_SIZE_SM_PADDING_X": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "SM",
      "PADDING_X"
    ],
    "value": "12px",
    "aliasOf": "SPACING_3",
    "type": "dimension",
    "category": "component",
    "description": "Small button horizontal padding — 12 px (px-3)."
  },
  "CARD_FOOTER_GAP": {
    "rawPath": [
      "CARD",
      "FOOTER",
      "GAP"
    ],
    "value": "12px",
    "aliasOf": "SPACING_3",
    "type": "dimension",
    "category": "component",
    "description": "Gap between action buttons in CardFooter (12 px)."
  },
  "BUTTON_SIZE_DEFAULT_PADDING_X": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "DEFAULT",
      "PADDING_X"
    ],
    "value": "16px",
    "aliasOf": "SPACING_4",
    "type": "dimension",
    "category": "component",
    "description": "Default button horizontal padding — 16 px (px-4)."
  },
  "BUTTON_SIZE_LG_PADDING_Y": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "LG",
      "PADDING_Y"
    ],
    "value": "16px",
    "aliasOf": "SPACING_4",
    "type": "dimension",
    "category": "component",
    "description": "Large button vertical padding — 16 px (py-4)."
  },
  "CARD_GAP": {
    "rawPath": [
      "CARD",
      "GAP"
    ],
    "value": "16px",
    "aliasOf": "SPACING_4",
    "type": "dimension",
    "category": "component",
    "description": "Vertical gap between direct children of the Card stack (16 px)."
  },
  "CARD_FOOTER_PADDING_TOP": {
    "rawPath": [
      "CARD",
      "FOOTER",
      "PADDING_TOP"
    ],
    "value": "16px",
    "aliasOf": "SPACING_4",
    "type": "dimension",
    "category": "component",
    "description": "Top padding added to CardFooter when action buttons are present (16 px)."
  },
  "BUTTON_SIZE_LG_PADDING_X": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "LG",
      "PADDING_X"
    ],
    "value": "20px",
    "aliasOf": "SPACING_5",
    "type": "dimension",
    "category": "component",
    "description": "Large button horizontal padding — 20 px (px-5)."
  },
  "CARD_PADDING": {
    "rawPath": [
      "CARD",
      "PADDING"
    ],
    "value": "24px",
    "aliasOf": "SPACING_6",
    "type": "dimension",
    "category": "component",
    "description": "Default inset padding applied to the Card root (24 px). Consumers may override per-instance."
  },
  "BUTTON_SIZE_SM_HEIGHT": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "SM",
      "HEIGHT"
    ],
    "value": "32px",
    "aliasOf": "SPACING_7",
    "type": "dimension",
    "category": "component",
    "description": "Small button height (h-8)."
  },
  "BUTTON_SIZE_DEFAULT_HEIGHT": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "DEFAULT",
      "HEIGHT"
    ],
    "value": "40px",
    "aliasOf": "SPACING_8",
    "type": "dimension",
    "category": "component",
    "description": "Default button height (h-10)."
  },
  "BUTTON_SIZE_LG_HEIGHT": {
    "rawPath": [
      "BUTTON",
      "SIZE",
      "LG",
      "HEIGHT"
    ],
    "value": "48px",
    "aliasOf": "SPACING_9",
    "type": "dimension",
    "category": "component",
    "description": "Large button height (h-12)."
  },
  "BUTTON_RADIUS": {
    "rawPath": [
      "BUTTON",
      "RADIUS"
    ],
    "value": "8px",
    "aliasOf": "RADII_SM",
    "type": "dimension",
    "category": "component",
    "description": "Corner radius shared by all button variants (8 px / rounded-lg)."
  },
  "CARD_RADIUS": {
    "rawPath": [
      "CARD",
      "RADIUS"
    ],
    "value": "16px",
    "aliasOf": "RADII_LG",
    "type": "dimension",
    "category": "component",
    "description": "Corner radius of the Card surface (16 px / rounded-2xl)."
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
