import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postReplyOnce } from './replies.mjs';

const input = {
  botUser: 'BOT', parent: { ts: '1' }, replyId: 'deployment-123-2-completed',
  message: { channel: 'CDEPLOY', text: 'Deployment finished' },
};
const reply = {
  user: 'BOT', ts: '2', thread_ts: '1',
  metadata: { event_type: 'polar_deployment_reply', event_payload: { id: input.replyId } },
};

test('finds an existing reply on a later page without trusting another user or run attempt', async () => {
  let pages = 0;
  const result = await postReplyOnce({
    ...input,
    slack: async (method, payload) => {
      assert.equal(method, 'conversations.replies');
      assert.equal(payload.channel, 'CDEPLOY');
      assert.equal(payload.ts, '1');
      assert.equal(payload.include_all_metadata, true);
      pages++;
      if (!payload.cursor) return {
        messages: [
          { ...reply, user: 'OTHER' },
          { ...reply, thread_ts: 'other-parent' },
          { ...reply, metadata: { ...reply.metadata, event_payload: { id: 'deployment-123-1-completed' } } },
        ],
        response_metadata: { next_cursor: 'page-two' },
      };
      assert.equal(payload.cursor, 'page-two');
      return { messages: [reply] };
    },
  });
  assert.equal(pages, 2);
  assert.equal(result.ts, reply.ts);
});

test('a reply lookup failure prevents sending another reply', async () => {
  await assert.rejects(postReplyOnce({
    ...input,
    slack: async method => {
      assert.equal(method, 'conversations.replies');
      throw new Error('missing_scope');
    },
  }), /missing_scope/);
});

test('a lost post response is recovered from the reply on retry', async () => {
  const messages = [];
  const args = {
    ...input,
    slack: async (method, payload) => {
      if (method === 'conversations.replies') return { messages };
      assert.equal(method, 'chat.postMessage');
      messages.push({ ...payload, user: 'BOT', ts: '2' });
      throw new Error('response lost');
    },
  };
  await assert.rejects(postReplyOnce(args), /response lost/);
  const result = await postReplyOnce(args);
  assert.equal(messages.length, 1);
  assert.equal(result.ts, '2');
});
