'use client'

import { get, post } from '@/api'
import type { Agent, Member } from '@/db/schema'
import type { AgentNode, MemberNode, Tree } from '@/channels'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import { useMemberNode, useTree } from './live'

/**
 * Members and agents come from the live tree, so a list, a node and the
 * standings never disagree. Only what the tree does not carry — a system
 * prompt, a thread — is read from a route of its own.
 */

export const keys = {
  agent: (agentId: string) => ['agents', agentId] as const,
  messages: (agentId: string) => ['agents', agentId, 'messages'] as const,
}

const TREE_KEY = ['live', 'tree'] as const

export const useMembers = (): readonly MemberNode[] => useTree().members

export const useAgents = (memberId: string): readonly AgentNode[] =>
  useMemberNode(memberId).agents

export const useAgent = (agentId: string) =>
  useQuery({
    queryKey: keys.agent(agentId),
    queryFn: () => get<Agent>(`/api/agents/${agentId}`),
    enabled: !!agentId,
  })

export const useMessages = (agentId: string) =>
  useQuery({
    queryKey: keys.messages(agentId),
    queryFn: () => get<UIMessage[]>(`/api/agents/${agentId}/messages`),
    enabled: !!agentId,
  })

const fresh = { usage: 0, credits: 0, remaining: null }

export const useCreateMember = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; cap: number }) =>
      post<Member>('/api/members', input),
    onSuccess: (member) =>
      client.setQueryData<Tree>(TREE_KEY, (tree) =>
        !tree || tree.members.some((node) => node.id === member.id)
          ? tree
          : {
              ...tree,
              members: [
                ...tree.members,
                { ...member, standing: fresh, agents: [] },
              ],
            },
      ),
  })
}

export const useCreateAgent = (memberId: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      model: string
      systemPrompt: string
    }) => post<Agent>(`/api/members/${memberId}/agents`, input),
    onSuccess: (agent) => {
      client.setQueryData(keys.agent(agent.id), agent)
      client.setQueryData<Tree>(TREE_KEY, (tree) =>
        !tree
          ? tree
          : {
              ...tree,
              members: tree.members.map((member) =>
                member.id !== memberId ||
                member.agents.some((node) => node.id === agent.id)
                  ? member
                  : {
                      ...member,
                      agents: [
                        ...member.agents,
                        {
                          id: agent.id,
                          memberId: agent.memberId,
                          name: agent.name,
                          model: agent.model,
                          standing: fresh,
                        },
                      ],
                    },
              ),
            },
      )
    },
  })
}
