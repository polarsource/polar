import { twMerge } from "tailwind-merge";

const sizeClasses = {
  small: "px-[0.5em] py-[0.2em] text-xs",
  medium: "px-[0.7em] py-[0.3em] text-sm",
};

export type StatusColor =
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "purple"
  | "gray";

const colorClasses: Record<StatusColor, string> = {
  green:
    "bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500",
  red: "bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-500",
  yellow:
    "bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500",
  blue: "bg-indigo-100 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-500",
  purple:
    "bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400",
  gray: "bg-gray-200 text-gray-500 dark:bg-polar-700 dark:text-polar-500",
};

export interface StatusProps {
  status: string;
  /** Applies a predefined color treatment. Omit for a neutral, color-less chip. */
  color?: StatusColor;
  size?: "small" | "medium";
}

// Styling is intentionally closed: no `className` escape hatch. Use `color` and
// `size`; the chip sizes to its content (`w-fit`), so callers never need it.
export const Status = ({ status, color, size = "medium" }: StatusProps) => {
  return (
    <div
      className={twMerge(
        "flex w-fit flex-row items-center justify-center rounded-[0.5em]",
        sizeClasses[size],
        color ? colorClasses[color] : undefined,
      )}
    >
      {status}
    </div>
  );
};
