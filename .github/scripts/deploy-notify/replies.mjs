export async function postReplyOnce({ slack, botUser, parent, message, replyId }) {
  let cursor;
  do {
    const page = await slack('conversations.replies', {
      channel: message.channel, ts: parent.ts, limit: 100, include_all_metadata: true,
      ...(cursor ? { cursor } : {}),
    });
    const existing = page.messages.find(reply =>
      reply.user === botUser && reply.thread_ts === parent.ts && reply.ts !== parent.ts &&
      reply.metadata?.event_type === 'polar_deployment_reply' && reply.metadata.event_payload?.id === replyId,
    );
    if (existing) return existing;
    cursor = page.response_metadata?.next_cursor;
  } while (cursor);

  return slack('chat.postMessage', {
    ...message, thread_ts: parent.ts,
    metadata: { event_type: 'polar_deployment_reply', event_payload: { id: replyId } },
  });
}
