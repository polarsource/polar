"use client";

import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit";
import { Github } from "lucide-react";
import { usePathname } from "next/navigation";

const REPO_BASE =
  "https://github.com/polarsource/polar/blob/main/clients/packages/orbit/src/";

// Maps a route slug to the file (relative to packages/orbit/src) that defines
// the documented component or tokens. Props all live in the component file, so
// linking the file is the useful granularity.
const SOURCE_PATHS: Record<string, string> = {
  // Components
  box: "components/Box.tsx",
  grid: "components/Grid.tsx",
  text: "components/Text.tsx",
  button: "components/Button.tsx",
  avatar: "components/Avatar.tsx",
  pill: "components/Pill.tsx",
  status: "components/Status.tsx",
  checkbox: "components/Checkbox.tsx",
  switch: "components/Switch.tsx",
  input: "components/Input.tsx",
  textarea: "components/TextArea.tsx",
  select: "components/Select.tsx",
  tabs: "components/Tabs.tsx",
  "segmented-control": "components/SegmentedControl.tsx",
  spinner: "components/Spinner.tsx",
  tooltip: "components/Tooltip.tsx",
  truncated: "components/Truncated.tsx",
  list: "components/List.tsx",
  datatable: "components/datatable/DataTable.tsx",
  // Foundations
  colors: "tokens/tokens.stylex.ts",
  spacing: "tokens/tokens.stylex.ts",
  radius: "tokens/tokens.stylex.ts",
  shadows: "tokens/tokens.stylex.ts",
  motion: "tokens/tokens.stylex.ts",
  typography: "components/Text.tsx",
};

export function SourceLink() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).pop() ?? "";
  const path = SOURCE_PATHS[slug];

  if (!path) {
    return null;
  }

  return (
    <a href={`${REPO_BASE}${path}`} target="_blank" rel="noreferrer">
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        columnGap="s"
        paddingHorizontal="m"
        paddingVertical="xs"
        borderRadius="s"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        color={{ base: "text-secondary", hover: "text-primary" }}
        backgroundColor={{ hover: "background-card" }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Github size={14} aria-hidden />
        <Text variant="default" color="inherit">
          Source
        </Text>
      </Box>
    </a>
  );
}
