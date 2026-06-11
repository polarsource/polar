import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit";
import { type ReactNode } from "react";
import { SourceLink } from "./SourceLink";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <Box
      as="header"
      flexDirection="column"
      rowGap="xl"
      paddingBottom="xl"
      marginBottom="2xl"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {eyebrow && (
        <Text variant="label" color="default">
          {eyebrow}
        </Text>
      )}
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        flexWrap="wrap"
        rowGap="m"
      >
        <Text variant="heading-s" as="h1">
          {title}
        </Text>
        <SourceLink />
      </Box>
      {description && (
        <Text variant="heading-xxs" color="muted">
          {description}
        </Text>
      )}
    </Box>
  );
}
