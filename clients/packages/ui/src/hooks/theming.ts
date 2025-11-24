export type ThemePreset = 'polar' | 'midday'

export type StripeThemingPresetProps = Record<string, unknown>

export interface ThemingPresetProps {
  stripe: StripeThemingPresetProps
}

export const useThemePreset = (
  theme?: 'light' | 'dark',
): ThemingPresetProps => {
  const inputBoxShadow =
    theme === 'dark'
      ? 'none'
      : 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
  const focusBoxShadow =
    theme === 'dark'
      ? 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 71, 184, 0.4) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
      : 'rgb(255, 255, 255) 0px 0px 0px 0px, rgb(204, 224, 255) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'

  return {
    stripe: {
      theme: theme === 'dark' ? 'night' : 'stripe',
      rules: {
        '.Label': {
          color: theme === 'dark' ? 'white' : 'black',
          fontWeight: '500',
          fontSize: '14px',
          marginBottom: '8px',
        },
        '.PickerItem': {
          padding: '12px',
          backgroundColor: theme === 'dark' ? 'rgb(23 23 25)' : 'white',
          color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
          borderRadius: '0.75rem',
          boxShadow: inputBoxShadow,
          borderColor: 'transparent',
        },
        '.PickerItem--selected': {
          backgroundColor: theme === 'dark' ? 'rgb(23 23 25)' : 'white',
          borderColor: '#0062FF',
          borderWidth: '2px',
        },
        '.PickerItem--selected:hover': {
          backgroundColor: theme === 'dark' ? 'rgb(23 23 25)' : 'white',
        },
        '.Input': {
          padding: '12px',
          backgroundColor: theme === 'dark' ? 'rgb(23 23 25)' : 'white',
          color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
          borderRadius: '0.75rem',
          borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
          boxShadow: inputBoxShadow,
        },
        '.Input:focus': {
          borderColor:
            theme === 'dark' ? 'rgb(0, 84, 219)' : 'rgb(102, 161, 255)',
          boxShadow: focusBoxShadow,
        },
        '.Tab': {
          backgroundColor: theme === 'dark' ? 'rgb(23 23 25)' : 'white',
          borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
        },
        '.Tab--selected': {
          backgroundColor: 'rgb(51, 129, 255)',
          boxShadow: focusBoxShadow,
          border: 'none',
        },
        '.Tab:focus': {
          boxShadow: focusBoxShadow,
        },
        '.TabLabel--selected': {
          color: 'white',
        },
        '.TabIcon--selected': {
          fill: 'white',
        },
        '.Block': {
          backgroundColor: 'transparent',
          borderColor: theme === 'dark' ? '#353641' : '#EEE',
        },
      },
      variables: {
        borderRadius: '8px',
        fontSizeBase: '1rem',
        spacingGridRow: '18px',
        colorDanger: theme === 'dark' ? '#F17878' : '#E64D4D',
      },
    },
  }
}

// Deprecation helper, `useThemePreset` should not be used as it triggers hooks linter rules
// but it's not a hook (`use` prefix is reserved)
export const getThemePreset = (
  preset: ThemePreset | (string & {}),
  theme?: 'light' | 'dark',
) => {
  return useThemePreset(theme)
}
