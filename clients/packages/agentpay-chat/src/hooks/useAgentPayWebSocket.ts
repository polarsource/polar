"""
WebSocket hook for AgentPay chat
"""

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentPayMessage } from '../types';

interface UseAgentPayWebSocketProps {
  apiEndpoint: string;
  conversationId: string | null;
  onMessage: (message: AgentPayMessage) => void;
  enableStreaming?: boolean;
}

export function useAgentPayWebSocket({
  apiEndpoint,
  conversationId,
  onMessage,
  enableStreaming = true,
}: UseAgentPayWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!conversationId || !enableStreaming) return;

    const wsUrl = apiEndpoint
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    const ws = new WebSocket(`${wsUrl}/conversations/${conversationId}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            console.log('Connection acknowledged');
            break;

          case 'user_message':
            // User's own message echoed back (ignore)
            break;

          case 'agent_message':
            setIsTyping(false);
            onMessage(data.message);
            break;

          case 'typing':
            setIsTyping(data.is_typing);
            break;

          case 'pong':
            // Heartbeat response
            break;

          case 'error':
            console.error('WebSocket error:', data.error);
            break;

          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Attempt to reconnect after 3 seconds
      if (enableStreaming) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          // Re-trigger effect
        }, 3000);
      }
    };

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.close();
    };
  }, [conversationId, apiEndpoint, enableStreaming, onMessage]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        return;
      }

      setIsTyping(true);

      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          content,
          context: {},
        })
      );
    },
    []
  );

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
      })
    );
  }, []);

  return {
    sendMessage,
    sendTyping,
    isConnected,
    isTyping,
  };
}
