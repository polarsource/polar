/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Relationship } from './Relationship';

export type IssueRelationship = {
  pledges?: Array<Relationship>;
  organization?: Relationship;
  repository?: Relationship;
  references?: Array<Relationship>;
  dependencies?: Array<Relationship>;
};

