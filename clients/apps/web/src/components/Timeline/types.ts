import { ReactNode } from "react";

export interface TimelineGroupEntry {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
}

export interface TimelineEventItem {
  kind: "event";
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: ReactNode;
}

export interface TimelineGroupItem {
  kind: "group";
  id: string;
  title: string;
  icon?: ReactNode;
  timestamp: { start: string; end: string };
  items: TimelineGroupEntry[];
}

export type TimelineItem = TimelineEventItem | TimelineGroupItem;

export interface TimelineSection {
  formattedDate: string;
  items: TimelineItem[];
}
