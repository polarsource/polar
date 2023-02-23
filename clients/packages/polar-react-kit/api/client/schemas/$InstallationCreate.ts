/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $InstallationCreate = {
  properties: {
    platform: {
      type: 'Enum',
      isRequired: true,
    },
    external_id: {
      type: 'number',
      isRequired: true,
    },
  },
} as const;
