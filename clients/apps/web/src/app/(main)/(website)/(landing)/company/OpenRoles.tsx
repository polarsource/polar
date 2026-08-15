import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

const JOBS = [
  {
    category: 'Design',
    roles: [
      {
        role: 'Senior Product Designer',
        location: 'Remote, Europe',
        experience: '8+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/ec140cc5-fe50-4c7a-9131-3dd718d2b02d',
      },
    ],
  },
  {
    category: 'Product & Engineering',
    roles: [
      {
        role: 'Senior Platform Engineer',
        location: 'Remote, Europe',
        experience: '5-8+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/8a82633e-e7b9-42f4-92e1-33032a56097a',
      },
      {
        role: 'Senior Product Engineer',
        location: 'Remote, Europe',
        experience: '7+ Years Experience',
        link: 'https://jobs.ashbyhq.com/polar/955c6935-6d03-46e5-b649-a8b958a52962',
      },
    ],
  },
  {
    category: 'Merchant Operations',
    roles: [
      {
        role: 'Risk & Compliance Specialist',
        link: 'https://jobs.ashbyhq.com/polar/87773c6c-4cd4-4948-9779-20fdc8f8ea7b',
        location: 'Remote, United States',
        experience: '2+ Years Experience',
      },
      {
        role: 'Merchant Support Specialist',
        link: 'https://jobs.ashbyhq.com/polar/2f3744b5-f33b-4611-bdfa-d99700dfa0e7',
        location: 'Remote, United States',
        experience: '2+ Years Experience',
      },
    ],
  },
]

export const OpenRoles = () => (
  <Box flexDirection="column" rowGap="3xl">
    {JOBS.map(({ category, roles }) => (
      <Box key={category} flexDirection="column" rowGap="xl">
        <Text variant="heading-s" as="h3">
          {category}
        </Text>
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
                  <Box columnGap="s">
                    {job.experience && (
                      <>
                        <Text as="span" color="muted" variant="heading-xxs">
                          {job.experience}
                        </Text>
                        <Text as="span" color="muted" variant="heading-xxs">
                          ·
                        </Text>
                      </>
                    )}
                    <Text as="span" color="muted" variant="heading-xxs">
                      {job.location}
                    </Text>
                  </Box>
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
