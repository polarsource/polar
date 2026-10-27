import {
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const FLAGGED_FILES_DOCS_URL =
  'https://polar.sh/docs/features/benefits/file-downloads#flagged-files'

export const FlaggedMaliciousStatus = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Box as="span" flexShrink={0}>
        <Status status="Malicious file detected" color="red" size="small" />
      </Box>
    </TooltipTrigger>
    <TooltipContent side="bottom" align="start">
      <Box flexDirection="column" rowGap="xs" maxWidth={280}>
        <Text variant="caption">
          Our malware scanning flagged this file. Customers can no longer
          download it.
        </Text>
        <a
          href={FLAGGED_FILES_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline"
        >
          What can I do about this?
        </a>
      </Box>
    </TooltipContent>
  </Tooltip>
)
