import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

const JOBS = [
  {
    category: 'Always Open',
    roles: [
      {
        role: 'Platform Engineering',
        link: 'https://jobs.ashbyhq.com/polar/0b058d3d-f00a-480c-9e3b-481aa8904f09',
      },
      {
        role: 'Product Engineering',
        link: 'https://jobs.ashbyhq.com/polar/d2f09190-24ec-444f-8642-98596af4a793',
      },
    ],
  },
]

export const OpenRoles = () => (
  <Box flexDirection="column" rowGap="3xl">
    {JOBS.map(({ category, roles }) => (
      <Box key={category} flexDirection="column" rowGap="xl">
        <Box flexDirection="column" rowGap="l">
          <Text variant="heading-s" as="h3">
            {category}
          </Text>
          <Text variant="heading-xs" as="p" color="muted" wrap="pretty">
            We hire when we meet exceptional people and review applications on a
            rolling basis. While this means we can&apos;t guarantee a specific
            response timeline, strong applications always get our attention.
          </Text>
        </Box>
        <Box flexDirection="column">
          {roles.map((job) => (
            <Link
              key={job.link}
              href={job.link}
              target="_blank"
              className="group"
            >
              <Box
                alignItems="baseline"
                justifyContent="between"
                columnGap="l"
                paddingVertical="xl"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Box flexDirection="column" rowGap="xs" flex={1}>
                  <Text variant="heading-xxs" as="span">
                    <span className="group-hover:underline">{job.role}</span>
                  </Text>
                </Box>
                <ArrowOutwardOutlined fontSize="inherit" />
              </Box>
            </Link>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
)
