import { describe, expect, it } from 'vitest'
import { isPrivateIP } from './WebhookForm'

describe('isPrivateIP', () => {
  describe('IPv4 private ranges', () => {
    it('blocks 10.x.x.x', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true)
      expect(isPrivateIP('10.255.255.255')).toBe(true)
    })

    it('blocks 172.16-31.x.x', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true)
      expect(isPrivateIP('172.31.255.255')).toBe(true)
      expect(isPrivateIP('172.15.0.1')).toBe(false)
      expect(isPrivateIP('172.32.0.1')).toBe(false)
    })

    it('blocks 192.168.x.x', () => {
      expect(isPrivateIP('192.168.0.1')).toBe(true)
      expect(isPrivateIP('192.168.255.255')).toBe(true)
      expect(isPrivateIP('192.169.0.1')).toBe(false)
    })

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isPrivateIP('169.254.0.1')).toBe(true)
      expect(isPrivateIP('169.254.255.255')).toBe(true)
    })

    it('blocks 127.x.x.x (loopback)', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true)
      expect(isPrivateIP('127.255.255.255')).toBe(true)
    })

    it('blocks 0.x.x.x', () => {
      expect(isPrivateIP('0.0.0.0')).toBe(true)
    })

    it('blocks 100.64-127.x.x (CGNAT)', () => {
      expect(isPrivateIP('100.64.0.1')).toBe(true)
      expect(isPrivateIP('100.127.255.255')).toBe(true)
      expect(isPrivateIP('100.63.0.1')).toBe(false)
      expect(isPrivateIP('100.128.0.1')).toBe(false)
    })

    it('allows public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false)
      expect(isPrivateIP('216.150.1.1')).toBe(false)
      expect(isPrivateIP('1.1.1.1')).toBe(false)
    })
  })

  describe('IPv6 private addresses', () => {
    it('blocks fc00::/7 unique-local addresses', () => {
      expect(isPrivateIP('fc00::1')).toBe(true)
      expect(isPrivateIP('fd00::1')).toBe(true)
      expect(isPrivateIP('fd12:3456:789a::1')).toBe(true)
    })

    it('blocks fe80:: link-local addresses', () => {
      expect(isPrivateIP('fe80::1')).toBe(true)
      expect(isPrivateIP('fe80::abcd:1234')).toBe(true)
    })

    it('blocks bracketed IPv6 addresses', () => {
      expect(isPrivateIP('[fc00::1]')).toBe(true)
      expect(isPrivateIP('[fd00::1]')).toBe(true)
      expect(isPrivateIP('[fe80::1]')).toBe(true)
    })
  })

  describe('domain names starting with fc/fd — must NOT be blocked', () => {
    it('allows fctactix.com (the reported bug)', () => {
      expect(isPrivateIP('fctactix.com')).toBe(false)
    })

    it('allows other domains starting with fc', () => {
      expect(isPrivateIP('fcexample.com')).toBe(false)
      expect(isPrivateIP('fc-app.example.com')).toBe(false)
    })

    it('allows domains starting with fd', () => {
      expect(isPrivateIP('fdomain.example.com')).toBe(false)
      expect(isPrivateIP('fd-service.io')).toBe(false)
    })

    it('allows subdomains of fc/fd domains', () => {
      expect(isPrivateIP('staging.fctactix.com')).toBe(false)
      expect(isPrivateIP('hooks.fctactix.com')).toBe(false)
      expect(isPrivateIP('api.fdomain.com')).toBe(false)
    })
  })

  describe('regular domain names', () => {
    it('allows typical domains', () => {
      expect(isPrivateIP('example.com')).toBe(false)
      expect(isPrivateIP('api.polar.sh')).toBe(false)
      expect(isPrivateIP('webhook.site')).toBe(false)
      expect(isPrivateIP('hooks.slack.com')).toBe(false)
    })
  })
})
