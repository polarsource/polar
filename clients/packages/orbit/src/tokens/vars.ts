export const tokens = {
  "colors": {
    "bg": "var(--colors-bg)",
    "bg-surface": "var(--colors-bg-surface)",
    "bg-elevated": "var(--colors-bg-elevated)",
    "text": "var(--colors-text)",
    "text-subtle": "var(--colors-text-subtle)",
    "text-disabled": "var(--colors-text-disabled)",
    "destructive": "var(--colors-destructive)"
  },
  "radii": {
    "sm": "var(--radii-sm)",
    "md": "var(--radii-md)",
    "lg": "var(--radii-lg)",
    "xl": "var(--radii-xl)",
    "2xl": "var(--radii-2xl)",
    "full": "var(--radii-full)"
  },
  "spacing": {
    "spacing-0": "var(--spacing-spacing-0)",
    "spacing-1": "var(--spacing-spacing-1)",
    "spacing-2": "var(--spacing-spacing-2)",
    "spacing-3": "var(--spacing-spacing-3)",
    "spacing-4": "var(--spacing-spacing-4)",
    "spacing-5": "var(--spacing-spacing-5)",
    "spacing-6": "var(--spacing-spacing-6)",
    "spacing-8": "var(--spacing-spacing-8)",
    "spacing-10": "var(--spacing-spacing-10)",
    "spacing-12": "var(--spacing-spacing-12)",
    "spacing-16": "var(--spacing-spacing-16)",
    "spacing-32": "var(--spacing-spacing-32)"
  },
  "button": {
    "size": {
      "sm": {
        "height": "var(--button-size-sm-height)",
        "padding-x": "var(--button-size-sm-padding-x)",
        "padding-y": "var(--button-size-sm-padding-y)"
      },
      "default": {
        "height": "var(--button-size-default-height)",
        "padding-y": "var(--button-size-default-padding-y)",
        "padding-x": "var(--button-size-default-padding-x)"
      },
      "lg": {
        "height": "var(--button-size-lg-height)",
        "padding-x": "var(--button-size-lg-padding-x)",
        "padding-y": "var(--button-size-lg-padding-y)"
      }
    },
    "primary": {
      "background": "var(--button-primary-background)",
      "foreground": "var(--button-primary-foreground)"
    },
    "secondary": {
      "background": "var(--button-secondary-background)",
      "foreground": "var(--button-secondary-foreground)"
    },
    "destructive": {
      "foreground": "var(--button-destructive-foreground)",
      "background": "var(--button-destructive-background)"
    },
    "ghost": {
      "background": "var(--button-ghost-background)",
      "foreground": "var(--button-ghost-foreground)"
    },
    "radius": "var(--button-radius)"
  },
  "card": {
    "footer": {
      "gap": "var(--card-footer-gap)",
      "padding-top": "var(--card-footer-padding-top)"
    },
    "background": "var(--card-background)",
    "radius": "var(--card-radius)",
    "gap": "var(--card-gap)",
    "padding": "var(--card-padding)"
  },
  "status": {
    "neutral": {
      "background": "var(--status-neutral-background)",
      "foreground": "var(--status-neutral-foreground)"
    },
    "success": {
      "background": "var(--status-success-background)",
      "foreground": "var(--status-success-foreground)"
    },
    "warning": {
      "background": "var(--status-warning-background)",
      "foreground": "var(--status-warning-foreground)"
    },
    "error": {
      "background": "var(--status-error-background)",
      "foreground": "var(--status-error-foreground)"
    },
    "info": {
      "background": "var(--status-info-background)",
      "foreground": "var(--status-info-foreground)"
    }
  }
} as const
