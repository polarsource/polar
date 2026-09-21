'use client'

import { MODELS } from '@/constants'
import { useCreateAgent } from '@/hooks/queries'
import { Button } from '@polar-sh/orbit/Button'
import { Input } from '@polar-sh/orbit/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit/Select'
import { Text } from '@polar-sh/orbit/Text'
import { TextArea } from '@polar-sh/orbit/TextArea'
import { Box } from '@polar-sh/orbit/Box'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * A form behind a disclosure row. The mutation inserts the row and spawns the
 * billing identity, then opens the new agent's chat.
 */
export const NewAgentForm = ({ memberId }: { memberId: string }) => {
  const router = useRouter()
  const createAgent = useCreateAgent(memberId)

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const model = String(data.get('model') ?? '')
    const systemPrompt = String(data.get('systemPrompt') ?? '').trim()
    if (!name || !model) return
    createAgent.mutate(
      { name, model, systemPrompt },
      {
        onSuccess: (agent) => {
          form.reset()
          router.push(`/members/${memberId}/agents/${agent.id}`)
        },
      },
    )
  }

  return (
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
        onSubmit={onSubmit}
        flexDirection="column"
        rowGap="xs"
        paddingHorizontal="xs"
        paddingTop="s"
      >
        <Input
          name="name"
          placeholder="Name"
          required
          className="h-8 text-xs"
        />
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
        <Button
          type="submit"
          size="sm"
          fullWidth
          loading={createAgent.isPending}
        >
          Create agent
        </Button>
      </Box>
    </details>
  )
}
