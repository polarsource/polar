# @agentpay/chat

Conversational commerce chat widget for AgentPay.

## Installation

```bash
npm install @agentpay/chat
# or
pnpm add @agentpay/chat
# or
yarn add @agentpay/chat
```

## Usage

### React

```tsx
import { AgentPayChat } from '@agentpay/chat';

function App() {
  return (
    <div>
      <YourContent />

      <AgentPayChat
        organizationId="your-org-id"
        agentType="sales"
        primaryColor="#3b82f6"
        onCheckout={(url) => {
          window.location.href = url;
        }}
      />
    </div>
  );
}
```

### Astro

```astro
---
import AgentPayChat from '@agentpay/chat/astro';
---

<html>
  <body>
    <h1>My Shop</h1>

    <AgentPayChat
      organizationId="your-org-id"
      agentType="sales"
      primaryColor="#3b82f6"
    />
  </body>
</html>
```

### Vanilla HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Shop</title>
</head>
<body>
  <h1>My Shop</h1>

  <div id="agentpay-chat"></div>

  <script type="module">
    import { AgentPayChat } from 'https://unpkg.com/@agentpay/chat';
    import { createRoot } from 'https://unpkg.com/react-dom@18/client';
    import { createElement } from 'https://unpkg.com/react@18';

    const root = createRoot(document.getElementById('agentpay-chat'));
    root.render(
      createElement(AgentPayChat, {
        organizationId: 'your-org-id',
        agentType: 'sales',
        primaryColor: '#3b82f6',
      })
    );
  </script>
</body>
</html>
```

## API Reference

### AgentPayChat Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `organizationId` | `string` | *required* | Your AgentPay organization ID |
| `agentType` | `'sales' \| 'support' \| 'payment'` | `'sales'` | Type of agent |
| `apiEndpoint` | `string` | `'http://localhost:8000/v1/agent'` | API endpoint |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Chat button position |
| `primaryColor` | `string` | `'#3b82f6'` | Primary brand color |
| `welcomeMessage` | `string` | Default welcome | Initial agent message |
| `onCheckout` | `(url: string) => void` | `undefined` | Callback when checkout URL generated |
| `onConversationStart` | `(conversationId: string) => void` | `undefined` | Callback when conversation starts |
| `enableStreaming` | `boolean` | `true` | Enable streaming responses |
| `enableTypingIndicator` | `boolean` | `true` | Show typing indicators |

## Features

- ✅ **Real-time chat** via WebSocket
- ✅ **Streaming responses** with Server-Sent Events
- ✅ **Typing indicators** for better UX
- ✅ **Mobile responsive** design
- ✅ **Customizable branding** (colors, position)
- ✅ **Conversation persistence** across page reloads
- ✅ **Automatic reconnection** if connection drops
- ✅ **TypeScript support** with full type definitions

## Styling

The widget uses Tailwind CSS internally but can be customized:

```tsx
<AgentPayChat
  organizationId="your-org-id"
  primaryColor="#10b981" // Green
  position="bottom-left"
/>
```

## Advanced Usage

### Custom Checkout Handler

```tsx
<AgentPayChat
  organizationId="your-org-id"
  onCheckout={(checkoutUrl) => {
    // Custom checkout handling
    if (window.confirm('Ready to checkout?')) {
      window.location.href = checkoutUrl;
    }
  }}
/>
```

### Track Conversation Events

```tsx
<AgentPayChat
  organizationId="your-org-id"
  onConversationStart={(conversationId) => {
    // Analytics tracking
    analytics.track('Conversation Started', {
      conversationId,
      timestamp: new Date(),
    });
  }}
/>
```

### Disable Streaming for Slow Connections

```tsx
<AgentPayChat
  organizationId="your-org-id"
  enableStreaming={false}
  enableTypingIndicator={false}
/>
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Apache 2.0

## Support

- Documentation: https://docs.agentpay.com
- Issues: https://github.com/yourusername/agentpay/issues
- Discord: https://discord.gg/agentpay
