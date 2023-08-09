const PolarLogo = () => {
  return (
    <svg
      width="18"
      height="20"
      viewBox="0 0 18 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.9404 13.6814C12.029 16.6702 8.19039 17.453 5.36668 15.4298C2.54297 13.4066 1.80341 9.34363 3.71484 6.35482C5.62626 3.36602 9.46485 2.58323 12.2886 4.60641C15.1123 6.62959 15.8518 10.6926 13.9404 13.6814Z"
        fill="#F8F8F6"
      />
      <path
        d="M13.5032 12.5506C12.0443 15.569 8.76765 16.882 6.18465 15.4832C3.60165 14.0845 2.69043 10.5037 4.14937 7.48528C5.60831 4.4669 8.88495 3.15394 11.4679 4.55269C14.0509 5.95145 14.9622 9.53225 13.5032 12.5506Z"
        fill="#3850AD"
      />
      <path
        d="M13.0467 11.4577C11.9948 14.8785 9.25187 17.0005 6.92025 16.1973C4.58863 15.394 3.55122 11.9697 4.60314 8.54879C5.65506 5.12791 8.39797 3.00591 10.7296 3.80917C13.0612 4.61243 14.0986 8.03678 13.0467 11.4577Z"
        fill="#F8F8F6"
      />
      <path
        d="M12.4003 10.8245C11.7415 14.0936 9.60784 16.3826 7.63458 15.9372C5.66132 15.4917 4.59571 12.4804 5.25447 9.21126C5.91323 5.94214 8.04691 3.65313 10.0202 4.09862C11.9934 4.54411 13.059 7.5554 12.4003 10.8245Z"
        fill="#3850AD"
      />
      <path
        d="M11.653 10.3243C11.2925 13.8983 9.73551 16.6526 8.17542 16.4763C6.61532 16.3 5.64289 13.2598 6.00343 9.68581C6.36397 6.11186 7.92096 3.35754 9.48105 3.53386C11.0411 3.71019 12.0136 6.75039 11.653 10.3243Z"
        fill="#F8F8F6"
      />
      <path
        d="M10.87 9.98484C10.9142 12.9503 10.0348 15.3695 8.90579 15.3884C7.77674 15.4073 6.82558 13.0186 6.78132 10.0532C6.73705 7.08779 7.61645 4.66853 8.7455 4.64965C9.87455 4.63077 10.8257 7.01942 10.87 9.98484Z"
        fill="#3850AD"
      />
    </svg>
  )
}

export const SeeksFundingShield = ({ count }: { count: number }) => {
  return (
    <div
      style={{
        display: 'flex',
        color: 'white',
        height: '20px',
        fontSize: 11,
        justifyItems: 'center',
        borderRadius: '3px',
        overflow: 'hidden',
        alignItems: 'center',
        // width: 'fit-content',
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: '0px 4px 0px 2px',
          justifyItems: 'center',
          height: '20px',
          alignItems: 'center',
          background:
            'linear-gradient(0deg, rgba(71,96,194,1) 0%, rgba(61,84,171,1) 100%)',
          flexShrink: 0,
        }}
      >
        <PolarLogo />
        <div
          style={{
            padding: '2px 3px 2px 3px',
          }}
        >
          Polar
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          height: '20px',
          padding: '0px 5px',
          justifyItems: 'center',
          alignItems: 'center',
          background:
            'linear-gradient(0deg, rgba(90,130,215,1) 0%, rgba(71,113,204,1) 100%)',
          flexShrink: 0,
        }}
      >
        {count} {count === 1 ? 'issue' : 'issues'} seek funding
      </div>
    </div>
  )
}
