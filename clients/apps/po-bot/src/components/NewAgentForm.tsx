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
import { Box } from '@polar-sh/orbit/Box'
import { Plus, X } from 'lucide-react'

/**
 * A server component form behind a disclosure row. The action inserts the
 * row and spawns the billing identity.
 */
export const NewAgentForm = ({ memberId }: { memberId: string }) => (
  <details className="disclosure">
    <summary>
      <Box
        className="nav-row"
        alignItems="center"
        columnGap="s"
        paddingHorizontal="s"
        paddingVertical="xs"
        borderRadius="m"
        color="text-secondary"
      >
        <Box as="span" className="disclosure-closed">
          <Plus size={14} />
        </Box>
        <Box as="span" className="disclosure-open">
          <X size={14} />
        </Box>
        <Text variant="caption" color="muted" as="span">
          New agent
        </Text>
      </Box>
    </summary>
    <Box
      as="form"
      action={createAgent}
      flexDirection="column"
      rowGap="xs"
      paddingHorizontal="xs"
      paddingTop="s"
    >
      <input type="hidden" name="memberId" value={memberId} />
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
    </Box>
  </details>
)
