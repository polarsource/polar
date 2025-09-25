import { JobLink, JobLinkProps } from './JobLink'

export interface JobSectionProps {
  title: string
  jobs: JobLinkProps[]
}

export const JobSection = ({ title, jobs }: JobSectionProps) => {
  return (
    <section className="flex flex-col gap-6 lg:gap-12">
      <h4 className="text-2xl">{title}</h4>
      <div className="flex flex-col gap-4">
        {jobs.map((job) => (
          <JobLink key={job.link} {...job} />
        ))}
      </div>
    </section>
  )
}
