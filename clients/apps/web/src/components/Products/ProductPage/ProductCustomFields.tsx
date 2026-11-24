import CustomFieldTypeIcon from '@/components/CustomFields/CustomFieldTypeIcon'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'

export interface ProductCustomFieldsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductCustomFields = ({
  organization,
  product,
}: ProductCustomFieldsProps) => {
  if (product.attached_custom_fields.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Checkout Fields
        </Text>
        <Text color="muted">Collected at checkout for {product.name}</Text>
      </Box>
      <List size="small">
        {product.attached_custom_fields.map(({ custom_field, required }) => (
          <Link
            key={custom_field.id}
            href={`/dashboard/${organization.slug}/settings/custom-fields`}
          >
            <ListItem size="small">
              <Box minWidth={0} flexGrow={1} alignItems="center" columnGap="m">
                <Box
                  width={32}
                  height={32}
                  flexShrink={0}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="s"
                  backgroundColor="background-secondary"
                  color="text-secondary"
                >
                  <CustomFieldTypeIcon type={custom_field.type} />
                </Box>
                <Text truncate>{custom_field.name}</Text>
              </Box>
              <Box flexShrink={0} alignItems="center" columnGap="m">
                <Text color="muted">{required ? 'Required' : 'Optional'}</Text>
                <Box color="text-tertiary" alignItems="center">
                  <ChevronRight size={16} />
                </Box>
              </Box>
            </ListItem>
          </Link>
        ))}
      </List>
    </Box>
  )
}
