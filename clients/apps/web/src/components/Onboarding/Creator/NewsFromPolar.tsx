import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Card, CardContent, CardFooter } from 'polarkit/components/ui/atoms'

export const NewsFromPolar = () => {
  return (
    <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
        <LogoIcon className="hidden h-16 w-16 text-blue-500 dark:text-blue-400 md:block" />
        <h2 className="text-2xl font-bold">New Features</h2>
        <p className="dark:text-polar-400 w-full text-gray-600 [text-wrap:balance]">
          Some of the latest features and updates along with Tips & Tricks for
          your journey with Polar
        </p>
      </div>
      <div className="col-span-2 flex flex-col gap-y-8">
        <Card>
          <CardContent className="flex flex-col py-8">
            <iframe
              className="aspect-video"
              width="100%"
              src="https://www.youtube.com/embed/QKx4o0z-SVY?si=MALUsFcsUkO0_5Uo"
              title="Private Access to GitHub Repos"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-y-4">
            <h2 className="text-lg font-medium">
              Introducing GitHub Repository Benefit
            </h2>
            <p className="dark:text-polar-400 leading-relaxed text-gray-600">
              You can now seamlessly offer subscribers on Polar access to one,
              two, three... or countless private GitHub repositories. This opens
              up and streamlines unlimited possibilities, monetization- and
              funding models.
            </p>
            <Link
              className="flex flex-row items-center gap-x-2 text-blue-500 dark:text-blue-400"
              href="/polarsource/posts/upsell-private-github-repositories"
            >
              <span>Learn more in our announcement post</span>
              <ArrowForward fontSize="small" />
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
