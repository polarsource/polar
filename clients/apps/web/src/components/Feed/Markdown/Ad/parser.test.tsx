import { parseBenefitIdsFromBody } from './EmailAd'

test('parseBenefitIdsFromBody', () => {
  const got = parseBenefitIdsFromBody(
    '<Ad subscriptionBenefitId="fceab239-714e-471c-b020-de58eabb8c88" /> lala <Ad subscriptionBenefitId="fceab239-0000-0000-b020-de58eabb8c88" />',
  )

  expect(got).toStrictEqual([
    'fceab239-714e-471c-b020-de58eabb8c88',
    'fceab239-0000-0000-b020-de58eabb8c88',
  ])
})
