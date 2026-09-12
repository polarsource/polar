import { describe, expect, it } from 'vitest'
import { inferPlatformFromUrl } from './socialPlatform'

describe('inferPlatformFromUrl', () => {
  describe('threads', () => {
    it('classifies the canonical threads.com domain', () => {
      expect(inferPlatformFromUrl('https://threads.com/@acme')).toBe('threads')
    })

    it('strips www. from threads.com', () => {
      expect(inferPlatformFromUrl('https://www.threads.com/@acme')).toBe(
        'threads',
      )
    })

    it('still recognises the legacy threads.net domain', () => {
      expect(inferPlatformFromUrl('https://threads.net/@acme')).toBe('threads')
      expect(inferPlatformFromUrl('https://www.threads.net/@acme')).toBe(
        'threads',
      )
    })
  })

  describe('other platforms', () => {
    it('classifies x (twitter.com and x.com)', () => {
      expect(inferPlatformFromUrl('https://twitter.com/polar')).toBe('x')
      expect(inferPlatformFromUrl('https://www.x.com/polar')).toBe('x')
    })

    it('classifies youtube (youtube.com and youtu.be)', () => {
      expect(inferPlatformFromUrl('https://youtube.com/@polar')).toBe('youtube')
      expect(inferPlatformFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'youtube',
      )
    })

    it('classifies github, discord, and facebook aliases', () => {
      expect(inferPlatformFromUrl('https://github.com/polarsource')).toBe(
        'github',
      )
      expect(inferPlatformFromUrl('https://discord.gg/polar')).toBe('discord')
      expect(inferPlatformFromUrl('https://discord.com/invite/polar')).toBe(
        'discord',
      )
      expect(inferPlatformFromUrl('https://fb.com/polar')).toBe('facebook')
    })
  })

  describe('fallback', () => {
    it('falls back to other for unknown hosts', () => {
      expect(inferPlatformFromUrl('https://example.com/acme')).toBe('other')
    })

    it('falls back to other for invalid URLs', () => {
      expect(inferPlatformFromUrl('not-a-url')).toBe('other')
      expect(inferPlatformFromUrl('')).toBe('other')
    })

    it('falls back to other while the protocol is being typed', () => {
      expect(inferPlatformFromUrl('https://')).toBe('other')
    })
  })
})
