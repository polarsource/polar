import { PublicDonation } from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { twMerge } from 'tailwind-merge'

interface DonationsFeedProps {
  donations: PublicDonation[]
}

export const DonationsFeed = ({ donations }: DonationsFeedProps) => {
  const getDonorName = (donation: PublicDonation) => {
    if (donation.donor) {
      return 'public_name' in donation.donor
        ? donation.donor.public_name
        : donation.donor.name
    } else {
      return 'An anonymous donor'
    }
  }

  if (donations.length < 1) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-8 md:gap-y-4">
      <div>
        <h3 className="text-lg">Donations</h3>
      </div>
      <ShadowBoxOnMd className="flex w-full flex-col gap-y-6 md:p-6">
        {donations.map((donation) => (
          <div
            key={donation.id}
            className={twMerge(
              'flex w-full flex-row gap-x-6',
              !donation.message && 'items-center',
            )}
          >
            <Avatar
              className="h-12 w-12"
              avatar_url={donation.donor?.avatar_url ?? null}
              name={getDonorName(donation)}
            />
            <div className="flex w-full flex-col gap-y-2">
              <h3 className="text-sm">
                <span className="font-medium">{getDonorName(donation)}</span>
                {` donated ${formatCurrencyAndAmount(donation.amount, donation.currency)}`}
              </h3>
              {donation.message && (
                <p className="dark:bg-polar-700 self-start rounded-full bg-gray-100 px-4 py-3 text-sm">
                  {donation.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </ShadowBoxOnMd>
    </div>
  )
}
