import FiberManualRecordRounded from "@mui/icons-material/FiberManualRecordRounded";
import FormattedDateTime from "@polar-sh/ui/components/atoms/FormattedDateTime";
import {
  cloneElement,
  isValidElement,
  ReactNode,
  useMemo,
  useState,
} from "react";
import { twMerge } from "tailwind-merge";
import { TimelineGroupItem, TimelineItem as TimelineItemType } from "./types";

export const TimelineItem = ({ item }: { item: TimelineItemType }) => {
  if (item.kind === "event") {
    return <TimelineEventItem item={item} />;
  }

  return <TimelineGroup item={item} />;
};

const TimelineEventItem = ({
  item,
}: {
  item: Extract<TimelineItemType, { kind: "event" }>;
}) => {
  return (
    <div className="relative pl-8">
      <div className="absolute top-4 left-0 flex size-6 -translate-x-1/2 items-center justify-center">
        {renderTimelineIcon(item.icon)}
      </div>

      <div className="dark:border-polar-700 dark:bg-polar-900 space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium">{item.title}</p>

        {item.description && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {item.description}
          </p>
        )}

        <p className="dark:text-polar-500 text-xs text-gray-500">
          <FormattedDateTime datetime={item.timestamp} resolution="time" />
        </p>
      </div>
    </div>
  );
};

const TimelineGroup = ({
  item,
}: {
  item: Extract<TimelineItemType, { kind: "group" }>;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rangeLabel = useMemo(() => groupRangeLabel(item), [item]);
  const itemCount = item.items.length;

  return (
    <div className="relative pl-8">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="absolute top-4 left-0 flex size-6 -translate-x-1/2 cursor-pointer items-center justify-center"
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? "Collapse grouped items" : "Expand grouped items"
        }
      >
        <TimelineStackedIcon icon={item.icon} count={itemCount} />
      </button>

      <div
        className="dark:border-polar-600 dark:bg-polar-900 cursor-pointer space-y-3 rounded-xl border border-dashed border-gray-300 bg-white p-4"
        onClick={() => setIsExpanded((value) => !value)}
      >
        <div className="w-full space-y-2 text-left">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {rangeLabel}
          </p>
        </div>

        {isExpanded && (
          <div className="space-y-3">
            {item.items.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <div className="dark:text-polar-300 flex items-center justify-between gap-4 text-xs text-gray-700">
                  <span>{entry.title}</span>
                  <FormattedDateTime
                    datetime={entry.timestamp}
                    resolution="time"
                  />
                </div>
                {entry.description && (
                  <p className="dark:text-polar-500 text-xs text-gray-500">
                    {entry.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TimelineStackedIcon = ({
  icon,
  count,
}: {
  icon?: ReactNode;
  count: number;
}) => {
  const stackSize = Math.min(3, Math.max(2, count));

  return (
    <div className="flex items-center justify-center">
      {Array.from({ length: stackSize }).map((_, index) => (
        <div
          key={index}
          className={twMerge(index > 0 && "-ml-3")}
          style={{ zIndex: stackSize - index }}
        >
          {renderTimelineIcon(icon)}
        </div>
      ))}
    </div>
  );
};

const renderTimelineIcon = (icon?: ReactNode): ReactNode => {
  if (!icon) {
    return (
      <span className="dark:bg-polar-800 dark:ring-polar-900 inline-flex size-6 items-center justify-center rounded-full bg-gray-100 ring-1 ring-white">
        <FiberManualRecordRounded className="dark:text-polar-200 text-sm text-gray-500" />
      </span>
    );
  }

  if (isValidElement(icon)) {
    return cloneElement(icon);
  }

  return icon;
};

const groupRangeLabel = (group: TimelineGroupItem): string => {
  const start = new Date(group.timestamp.start);
  const end = new Date(group.timestamp.end);
  const [earliest, latest] =
    start.getTime() <= end.getTime() ? [start, end] : [end, start];

  if (earliest.toDateString() === latest.toDateString()) {
    return `${earliest.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })} · ${latest.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `${earliest.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} → ${latest.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
};
