import { Text } from 'react-email'
import EmailLink from './text/EmailLink'
import InfoBox from './InfoBox'
import List from './List'
import ListItem from './ListItem'

interface LeakDetailsRow {
  label: string
  value: string
}

export function LeakDetails({
  rows,
  secretName,
}: {
  rows: LeakDetailsRow[]
  secretName: string
}) {
  return (
    <InfoBox title="Leak details" variant="info">
      <List>
        {rows.map((row) => (
          <ListItem key={row.label}>
            {row.label}: {row.value}
          </ListItem>
        ))}
      </List>
      <Text className="mt-4 mb-0 text-sm text-gray-600">
        As a reminder, {secretName} are super sensitive values that shouldn't be
        shared publicly on the web or in a code repository. Use dedicated
        features to safely store secrets, like{' '}
        <EmailLink href="https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions">
          GitHub Actions secrets
        </EmailLink>
        .
      </Text>
    </InfoBox>
  )
}

export default LeakDetails
