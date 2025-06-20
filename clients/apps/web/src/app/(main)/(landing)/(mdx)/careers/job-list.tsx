import { JobLink } from './job-link'

export const JobList = () => {
  return (
    <div className="flex flex-col gap-4">
      <JobLink
        role="Staff Frontend Engineer"
        description="Lead the development of our frontend codebase and how we ship composible billing components for developers"
        location="Remote — Europe"
        link="https://jobs.gem.com/polar/am9icG9zdDparTigzDB_RewSqH5o5htc"
      />
      <JobLink
        role="Staff Product Engineer"
        description="Work across our entire stack to ship innovative features to enhance how developers monetize their software."
        location="Remote — Europe"
        link="https://jobs.gem.com/polar/am9icG9zdDpgsiQcAqkm5Om5LnR4TJs2"
      />
      <JobLink
        role="Senior Product Engineer"
        description="Work across our entire stack to ship innovative features to enhance how developers monetize their software."
        location="Remote — Europe"
        link="https://jobs.gem.com/polar/am9icG9zdDpzKcc8t-KY2aAP96pbMHP_"
      />
      <JobLink
        role="Support Engineer"
        description="Help our customers get the most out of Polar. Improve our docs, build internal tooling and automations to scale those efforts."
        location="Remote — Europe"
        link="https://jobs.gem.com/polar/am9icG9zdDq-gyYKkPmJozQGu_MfvgJ_"
      />
      <JobLink
        role="Chief of Staff"
        description="Help us scale from an early-stage startup to scale-up."
        location="Stockholm"
        link="https://jobs.gem.com/polar/am9icG9zdDp6OvHLVgSUOIC87Ij7TiE9"
      />
    </div>
  )
}
