/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Issue } from './Issue';
import type { Relationship } from './Relationship';

export type Entry_Issue_ = {
  type: string;
  id: string;
  attributes: Issue;
  relationships?: Record<string, Relationship>;
};

