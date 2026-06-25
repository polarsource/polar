import { schemas } from '@polar-sh/client'
import { Avatar, Checkbox, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const OrganizationSelector = ({
  organizations,
}: {
  organizations: schemas['AuthorizeOrganization'][]
}) => {
  if (organizations.length === 0) {
    return null
  }

  return (
    <Box as="section" flexDirection="column" rowGap="m" marginBottom="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">Limit to organizations</Text>
        <Text variant="caption" color="muted">
          Optionally restrict this token to specific organizations. Leave all
          unchecked to grant access to every organization you belong to.
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        overflow="hidden"
      >
        {organizations.map((organization, index) => (
          <Box
            as="label"
            key={organization.id}
            display="flex"
            alignItems="center"
            columnGap="m"
            paddingHorizontal="m"
            paddingVertical="m"
            borderTopWidth={index === 0 ? 0 : 1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor={{ hover: 'background-secondary' }}
            transitionProperty="colors"
            transitionDuration="fast"
            cursor={{ hover: 'pointer' }}
          >
            <Checkbox name="organizations" value={organization.id} />
            <Avatar
              className="h-6 w-6"
              avatar_url={organization.avatar_url}
              name={organization.slug}
            />
            <Text variant="label">{organization.slug}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default OrganizationSelector
