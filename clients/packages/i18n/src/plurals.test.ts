import { describe, expect, it } from 'vitest'
import { createTranslator } from './index'

describe('createTranslator plurals', () => {
  describe('Polish (one / few / many)', () => {
    const t = createTranslator('pl')

    it.each([
      [1, '1 stanowisko'],
      [2, '2 stanowiska'],
      [5, '5 stanowisk'],
      [12, '12 stanowisk'],
      [22, '22 stanowiska'],
    ])('seats count %i', (count, expected) => {
      expect(t('checkout.pricing.seats.count', { count })).toBe(expected)
    })

    it.each([
      [1, 'Co tydzień'],
      [2, 'Co dwa tygodnie'],
      [5, 'Co 5 tygodni'],
      [22, 'Co 22 tygodnie'],
    ])(
      'exact =N match wins before the category, week %i',
      (count, expected) => {
        expect(t('checkout.pricing.everyInterval.week', { count })).toBe(
          expected,
        )
      },
    )

    it('resolves the base language from a regional locale', () => {
      expect(
        createTranslator('pl-PL')('checkout.pricing.seats.count', {
          count: 3,
        }),
      ).toBe('3 stanowiska')
    })
  })

  describe('French (one covers 0 and 1)', () => {
    const t = createTranslator('fr')

    it.each([
      [0, '0 siège inclus'],
      [1, 'Un siège inclus'],
      [5, '5 sièges inclus'],
    ])('exact =1 wins, one covers 0, included %i', (count, expected) => {
      expect(t('checkout.pricing.seats.included', { count })).toBe(expected)
    })

    it('falls back to other when the category key is absent', () => {
      expect(t('checkout.pricing.everyInterval.day', { count: 0 })).toBe(
        'Tous les 0 jours',
      )
    })
  })

  describe('locales without category keys', () => {
    it('uses =1 and other in English', () => {
      const t = createTranslator('en')
      expect(t('checkout.pricing.seats.count', { count: 1 })).toBe('1 seat')
      expect(t('checkout.pricing.seats.count', { count: 2 })).toBe('2 seats')
      expect(t('checkout.pricing.seats.count', { count: 21 })).toBe('21 seats')
    })

    it('keeps other for 0 in Brazilian Portuguese', () => {
      const t = createTranslator('pt')
      expect(t('checkout.pricing.seats.included', { count: 0 })).toBe(
        '0 usuários incluídos',
      )
      expect(t('checkout.pricing.everyInterval.day', { count: 0 })).toBe(
        'A cada 0 dias',
      )
    })

    it('falls back to other in German', () => {
      const t = createTranslator('de')
      expect(t('checkout.pricing.seats.count', { count: 1 })).toBe('1 Platz')
      expect(t('checkout.pricing.seats.count', { count: 3 })).toBe('3 Plätze')
    })
  })
})
