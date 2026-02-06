import { Hero } from '@/components/Landing/Hero/Hero'
import {
  companyTestimonials,
  Testamonial,
} from '@/components/Landing/Testimonials'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Successful teams & companies that believe in Polar',
  keywords:
    'customer success, customer stories, customers, polar, merchant of record, payments, billing',
  openGraph: {
    siteName: 'Polar',
    type: 'website',
    images: [
      {
        url: '/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: '/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar',
      },
    ],
  },
}

export default function Customers() {
  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-6xl flex-col gap-y-8 md:gap-y-16">
      <Hero
        title="Customer Stories"
        description="Polar powers thousands of successful startups"
      />
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col items-center justify-center gap-y-16">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            {companyTestimonials.map((testimonial, index) => (
              <Testamonial
                key={`testimonial-${index}`}
                size="lg"
                className={index === 0 ? 'xl:col-span-2' : ''}
                {...testimonial}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
