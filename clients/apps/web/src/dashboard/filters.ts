export type DashboardFilters = {
  q: string,
  tab: "issues" | "contributing" | "following",
  statusBacklog: boolean,
  statusBuild: boolean,
  statusPullRequest: boolean,
  statusCompleted: boolean,
}