export type ThemePreset = 'polar' | 'midday'

export interface PolarThemingPresetProps {
  input: string
  button: string
  buttonSecondary: string
  checkbox: string
  dropdown: string
  dropdownContent: string
  dropdownItem: string
  list: string
  listItem: string
  well: string
  wellSecondary: string
  table: string
  tableHeader: string
  checkoutWrapper: string
  checkoutInnerWrapper: string
  checkoutInfoWrapper: string
  checkoutCardWrapper: string
  checkoutProductSwitch: string
  checkoutProductSwitchSelected: string
  customerPortalWrapper: string
  customerPortalHeader: string
  customerPortalNavigationItem: string
  customerPortalNavigationItemActive: string
  customerPortalSubscriptionCard: string
}

export type StripeThemingPresetProps = Record<string, unknown>

export interface ThemingPresetProps {
  polar: PolarThemingPresetProps
  stripe: StripeThemingPresetProps
}

export const useThemePreset = (
  preset: ThemePreset,
  theme?: 'light' | 'dark',
): ThemingPresetProps => {
  switch (preset) {
    case 'polar':
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
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '0.75rem',
              boxShadow: inputBoxShadow,
              borderColor: 'transparent',
            },
            '.PickerItem--selected': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              borderColor: '#0062FF',
              borderWidth: '2px',
            },
            '.PickerItem--selected:hover': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
            },
            '.Input': {
              padding: '12px',
              backgroundColor: theme === 'dark' ? 'rgb(25, 25, 29)' : 'white',
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
              backgroundColor: theme === 'dark' ? 'rgb(25, 25, 29)' : 'white',
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
        polar: {
          input: 'bg-white shadow-xs',
          button: '',
          buttonSecondary: '',
          dropdown: '',
          dropdownContent: '',
          dropdownItem: '',
          checkbox: '',
          list: '',
          listItem: '',
          well: 'dark:bg-polar-900 bg-gray-50',
          wellSecondary: '',
          table: '',
          tableHeader: '',
          checkoutWrapper:
            'md:dark:bg-polar-950 md:bg-gray-100 dark:bg-polar-900 bg-white dark:text-white',
          checkoutInnerWrapper:
            'rounded-3xl dark:md:bg-polar-900 md:bg-white divide-gray-200 dark:divide-transparent',
          checkoutInfoWrapper: 'md:bg-gray-50 md:dark:bg-polar-950',
          checkoutCardWrapper:
            'dark:bg-polar-900 dark:border-polar-700 rounded-3xl! bg-white shadow-xs border border-gray-200',
          checkoutProductSwitch:
            'rounded-2xl md:shadow-none shadow-xs hover:border-blue-500 dark:hover:border-blue-500 divide-y divide-gray-200 dark:divide-polar-700 md:bg-white dark:md:bg-polar-950',
          checkoutProductSwitchSelected: 'border-blue-500 dark:border-blue-500',
          customerPortalWrapper: '',
          customerPortalHeader: 'dark:bg-polar-900 bg-gray-50',
          customerPortalNavigationItem: 'rounded-xl',
          customerPortalNavigationItemActive:
            'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
          customerPortalSubscriptionCard: '',
        },
      }
    case 'midday':
      return {
        stripe: {
          theme: 'night',
          rules: {
            '.Label': {
              color: 'white',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
            '.PickerItem': {
              padding: '12px',
              backgroundColor: '#1d1d1d',
              color: 'white',
              borderRadius: '0',
              borderColor: 'transparent',
              boxShadow: '0 0 0 transparent',
            },
            '.PickerItem:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
            '.PickerItem--selected': {
              backgroundColor: 'white',
              borderColor: '#0062FF',
              borderWidth: '2px',
            },
            '.PickerItem--selected:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
            '.Input': {
              padding: '12px',
              backgroundColor: '#1d1d1d',
              color: 'white',
              borderRadius: '0',
              border: 'none',
              boxShadow: '0 0 0 transparent',
            },
            '.Input:focus': {
              border: 'none',
              boxShadow: '0 0 0 transparent',
            },
            '.Tab': {
              backgroundColor: '#1d1d1d',
              border: 'none',
              boxShadow: '0 0 0 transparent',
            },
            '.Tab--selected': {
              backgroundColor: 'rgb(51, 129, 255)',
              border: 'none',
              boxShadow: '0 0 0 transparent',
            },
            '.Tab:focus': {},
            '.TabLabel--selected': {
              color: 'white',
              border: 'none',
              boxShadow: '0 0 0 transparent',
            },
            '.TabIcon--selected': {
              fill: 'white',
            },
            '.Block': {
              backgroundColor: 'transparent',
              borderColor: '#2c2c2c',
            },
          },
          variables: {
            borderRadius: '0',
            fontSizeBase: '1rem',
            spacingGridRow: '18px',
            colorDanger: '#F17878',
          },
        },
        polar: {
          input: 'rounded-none bg-[#1d1d1d] dark:bg-[#1d1d1d] border-none',
          button:
            'rounded-none bg-white dark:bg-white text-black dark:text-black',
          buttonSecondary:
            'rounded-none dark:bg-[#2C2C2C] dark:text-white dark:hover:bg-[#2C2C2C]',
          dropdown:
            'bg-[#1d1d1d] dark:bg-[#1d1d1d] border-none rounded-none hover:bg-[rgba(255,255,255,.1)] dark:hover:bg-[rgba(255,255,255,.1)]',
          dropdownContent: 'bg-[#1d1d1d] dark:bg-[#1d1d1d] rounded-none!',
          checkbox: 'rounded-none',
          dropdownItem: 'rounded-none!',
          list: 'rounded-none!',
          listItem: 'rounded-none!',
          well: 'rounded-none! dark:bg-[#1d1d1d]!',
          wellSecondary:
            'border rounded-none! dark:border-[#2c2c2c] dark:bg-transparent!',
          table: 'rounded-none! dark:border-[#2c2c2c]',
          tableHeader: 'dark:bg-[#1d1d1d] dark:text-[#878787]!',
          checkoutWrapper:
            'bg-[#121212] dark:bg-[#121212] md:bg-[#0c0c0c] md:dark:bg-[#0c0c0c] text-white',
          checkoutInnerWrapper:
            'md:bg-[#121212] dark:md:bg-[#121212] md:rounded-none!',
          checkoutInfoWrapper: 'dark:md:bg-transparent',
          checkoutCardWrapper:
            'dark:bg-[#1d1d1d] bg-[#1d1d1d] border-none rounded-none! text-white',
          checkoutProductSwitch:
            'rounded-none! bg-[#1d1d1d] hover:bg-[#ddd] divide-y divide-gray-500 dark:divide-[#2c2c2c] dark:hover:text-black',
          checkoutProductSwitchSelected:
            'bg-white text-black dark:divide-[#ccc]',
          customerPortalWrapper: 'dark:bg-[#121212]',
          customerPortalHeader: 'dark:bg-[#0c0c0c]',
          customerPortalNavigationItem:
            'hover:bg-transparent! hover:text-white!',
          customerPortalNavigationItemActive:
            'dark:bg-[#2c2c2c]! dark:text-white!',
          customerPortalSubscriptionCard: '',
        },
      }
  }
}
