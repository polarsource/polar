/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * Base User model.
 */
export type UserRead = {
  profile: any;
  id?: any;
  email: string;
  is_active?: boolean;
  is_superuser?: boolean;
  is_verified?: boolean;
};

