import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import {
  ArrowForward,
  BiotechOutlined,
  CalendarViewDay,
  EmojiPeople,
} from '@mui/icons-material'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms'

export const PostWizard = () => {
  return (
    <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
        <CalendarViewDay
          className="hidden text-blue-500 dark:text-blue-400 md:block"
          fontSize="large"
        />
        <h2 className="text-2xl font-bold">Start Writing</h2>
        <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
          Build out an audience by writing posts and share it with your
          subscribers
        </p>
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-x-8">
        <Card>
          <CardHeader className="gap-y-4 pb-4">
            <EmojiPeople
              fontSize="large"
              className="text-blue-500 dark:text-blue-400"
            />
            <h3 className="text-2xl font-bold">Hello World</h3>
          </CardHeader>
          <CardContent>
            <p className="dark:text-polar-500 text-gray-500">
              Introduce yourself and your projects. Let people know who you are
              & what you&apos;re working on.
            </p>
          </CardContent>
          <CardFooter>
            <AnimatedIconButton href="/" variant="default">
              <ArrowForward fontSize="inherit" />
            </AnimatedIconButton>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="gap-y-4 pb-4">
            <BiotechOutlined
              className="text-blue-500 dark:text-blue-400"
              fontSize="large"
            />
            <h3 className="text-2xl font-bold">Technical Deep-dive</h3>
          </CardHeader>
          <CardContent>
            <p className="dark:text-polar-500 text-gray-500">
              Proud of a project you&apos;ve been working on? Share the details
              & the secrets under the hood.
            </p>
          </CardContent>
          <CardFooter>
            <AnimatedIconButton href="/" variant="default">
              <ArrowForward fontSize="inherit" />
            </AnimatedIconButton>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
