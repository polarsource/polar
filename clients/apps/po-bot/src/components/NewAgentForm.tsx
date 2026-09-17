import { createAgent } from '@/actions'
import { MODELS } from '@/void'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  TextArea,
} from '@polar-sh/orbit'
import { Card } from './Card'

/** A server component form: the action inserts the row and spawns the billing identity. */
export const NewAgentForm = ({ memberId }: { memberId: string }) => (
  <Card
    as="form"
    action={createAgent}
    flexDirection="column"
    rowGap="xs"
    padding="s"
  >
    <input type="hidden" name="memberId" value={memberId} />
    <Text variant="caption" color="muted" as="h2">
      New agent
    </Text>
    <Input name="name" placeholder="Name" required className="h-8 text-xs" />
    <Select name="model" defaultValue={MODELS[1]}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <TextArea
      name="systemPrompt"
      placeholder="System prompt"
      rows={2}
      resizable={false}
      className="min-h-14 px-3 py-2 text-xs"
    />
    <Button type="submit" size="sm" fullWidth>
      Create agent
    </Button>
  </Card>
)
