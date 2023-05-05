import { classNames } from 'polarkit/utils'

interface Props {
  animate: boolean
  children: React.ReactNode
}

const LogoIcon = ({ animate }: { animate: boolean }) => {
  const classes = classNames(animate ? 'animate-pulse' : '', 'm-auto')
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={classes}
    >
      <path
        d="M31.9266 28.0734C27.4678 34.6603 18.5135 36.3854 11.9266 31.9266C5.33972 27.4678 3.61456 18.5135 8.07336 11.9266C12.5322 5.33973 21.4865 3.61457 28.0734 8.07337C34.6602 12.5322 36.3854 21.4865 31.9266 28.0734Z"
        fill="#364797"
      />
      <path
        d="M30.9098 25.5811C27.5065 32.2332 19.8631 35.1268 13.8377 32.0441C7.81234 28.9614 5.68671 21.0699 9.09 14.4178C12.4933 7.76571 20.1367 4.87213 26.1621 7.95479C32.1875 11.0374 34.3131 18.929 30.9098 25.5811Z"
        fill="white"
      />
      <path
        d="M29.846 23.1724C27.3921 30.7115 20.9938 35.3881 15.5548 33.6179C10.1158 31.8476 7.69579 24.3008 10.1496 16.7617C12.6034 9.22255 19.0018 4.54596 24.4408 6.31623C29.8798 8.08651 32.2998 15.6333 29.846 23.1724Z"
        fill="#364797"
      />
      <path
        d="M28.3354 21.7771C26.7987 28.9817 21.8214 34.0264 17.2184 33.0446C12.6154 32.0628 10.1296 25.4263 11.6663 18.2217C13.203 11.017 18.1802 5.97235 22.7833 6.95415C27.3863 7.93594 29.8721 14.5724 28.3354 21.7771Z"
        fill="white"
      />
      <path
        d="M26.5917 20.675C25.7507 28.5514 22.1187 34.6216 18.4794 34.233C14.8402 33.8444 12.5718 27.1442 13.4128 19.2678C14.2539 11.3913 17.8859 5.32115 21.5251 5.70974C25.1644 6.09834 27.4328 12.7985 26.5917 20.675Z"
        fill="#364797"
      />
      <path
        d="M24.7649 19.9266C24.8681 26.462 22.8168 31.7937 20.183 31.8353C17.5493 31.8769 15.3305 26.6127 15.2272 20.0773C15.124 13.5419 17.1754 8.21023 19.8091 8.16861C22.4429 8.127 24.6616 13.3912 24.7649 19.9266Z"
        fill="white"
      />
    </svg>
  )
}

const LoadingScreen = ({ animate, children }: Props) => {
  return (
    <>
      <div className="flex grow items-center justify-center">
        <div className="flex-row">
          <LogoIcon animate={animate} />
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </>
  )
}

LoadingScreen.defaultProps = {
  animate: true,
}

export default LoadingScreen

export const LoadingScreenError = (props: { error: string }) => {
  return (
    <>
      <strong>Oh no!</strong> {props.error}
    </>
  )
}
