export const tokens = {
  "COLORS": {
    "BG": "var(--COLORS-BG)",
    "BG_SURFACE": "var(--COLORS-BG_SURFACE)",
    "BG_ELEVATED": "var(--COLORS-BG_ELEVATED)",
    "TEXT": "var(--COLORS-TEXT)",
    "TEXT_SUBTLE": "var(--COLORS-TEXT_SUBTLE)",
    "TEXT_DISABLED": "var(--COLORS-TEXT_DISABLED)",
    "DESTRUCTIVE": "var(--COLORS-DESTRUCTIVE)"
  },
  "SPACING": {
    "SPACING_0": "var(--SPACING-SPACING_0)",
    "SPACING_1": "var(--SPACING-SPACING_1)",
    "SPACING_2": "var(--SPACING-SPACING_2)",
    "SPACING_3": "var(--SPACING-SPACING_3)",
    "SPACING_4": "var(--SPACING-SPACING_4)",
    "SPACING_5": "var(--SPACING-SPACING_5)",
    "SPACING_6": "var(--SPACING-SPACING_6)",
    "SPACING_8": "var(--SPACING-SPACING_8)",
    "SPACING_10": "var(--SPACING-SPACING_10)",
    "SPACING_12": "var(--SPACING-SPACING_12)",
    "SPACING_16": "var(--SPACING-SPACING_16)",
    "SPACING_32": "var(--SPACING-SPACING_32)"
  },
  "RADII": {
    "SM": "var(--RADII-SM)",
    "MD": "var(--RADII-MD)",
    "LG": "var(--RADII-LG)",
    "XL": "var(--RADII-XL)",
    "2XL": "var(--RADII-2XL)",
    "FULL": "var(--RADII-FULL)"
  },
  "BUTTON": {
    "SIZE": {
      "SM": {
        "HEIGHT": "var(--BUTTON-SIZE-SM-HEIGHT)",
        "PADDING_X": "var(--BUTTON-SIZE-SM-PADDING_X)",
        "PADDING_Y": "var(--BUTTON-SIZE-SM-PADDING_Y)"
      },
      "DEFAULT": {
        "HEIGHT": "var(--BUTTON-SIZE-DEFAULT-HEIGHT)",
        "PADDING_Y": "var(--BUTTON-SIZE-DEFAULT-PADDING_Y)",
        "PADDING_X": "var(--BUTTON-SIZE-DEFAULT-PADDING_X)"
      },
      "LG": {
        "HEIGHT": "var(--BUTTON-SIZE-LG-HEIGHT)",
        "PADDING_X": "var(--BUTTON-SIZE-LG-PADDING_X)",
        "PADDING_Y": "var(--BUTTON-SIZE-LG-PADDING_Y)"
      }
    },
    "PRIMARY": {
      "BACKGROUND": "var(--BUTTON-PRIMARY-BACKGROUND)",
      "FOREGROUND": "var(--BUTTON-PRIMARY-FOREGROUND)"
    },
    "SECONDARY": {
      "BACKGROUND": "var(--BUTTON-SECONDARY-BACKGROUND)",
      "FOREGROUND": "var(--BUTTON-SECONDARY-FOREGROUND)"
    },
    "DESTRUCTIVE": {
      "FOREGROUND": "var(--BUTTON-DESTRUCTIVE-FOREGROUND)",
      "BACKGROUND": "var(--BUTTON-DESTRUCTIVE-BACKGROUND)"
    },
    "GHOST": {
      "BACKGROUND": "var(--BUTTON-GHOST-BACKGROUND)",
      "FOREGROUND": "var(--BUTTON-GHOST-FOREGROUND)"
    },
    "RADIUS": "var(--BUTTON-RADIUS)"
  },
  "CARD": {
    "FOOTER": {
      "GAP": "var(--CARD-FOOTER-GAP)",
      "PADDING_TOP": "var(--CARD-FOOTER-PADDING_TOP)"
    },
    "BACKGROUND": "var(--CARD-BACKGROUND)",
    "GAP": "var(--CARD-GAP)",
    "PADDING": "var(--CARD-PADDING)",
    "RADIUS": "var(--CARD-RADIUS)"
  },
  "STATUS": {
    "NEUTRAL": {
      "BACKGROUND": "var(--STATUS-NEUTRAL-BACKGROUND)",
      "FOREGROUND": "var(--STATUS-NEUTRAL-FOREGROUND)"
    },
    "SUCCESS": {
      "BACKGROUND": "var(--STATUS-SUCCESS-BACKGROUND)",
      "FOREGROUND": "var(--STATUS-SUCCESS-FOREGROUND)"
    },
    "WARNING": {
      "BACKGROUND": "var(--STATUS-WARNING-BACKGROUND)",
      "FOREGROUND": "var(--STATUS-WARNING-FOREGROUND)"
    },
    "ERROR": {
      "BACKGROUND": "var(--STATUS-ERROR-BACKGROUND)",
      "FOREGROUND": "var(--STATUS-ERROR-FOREGROUND)"
    },
    "INFO": {
      "BACKGROUND": "var(--STATUS-INFO-BACKGROUND)",
      "FOREGROUND": "var(--STATUS-INFO-FOREGROUND)"
    }
  }
} as const
