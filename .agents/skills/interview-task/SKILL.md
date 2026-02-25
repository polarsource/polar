---
name: interview-task
description: Prepare an interview task for a candidate, as part of our hiring process.
user-invocable: true
allowed-tools: Bash(gh:*) Bash(git:*)
---

# Interview Task

This skill is a complete cookbook for creating an interview task for a candidate. It includes steps to create the necessary materials. The idea is to create a private repository for the candidate, and have an LLM agent draft a PR for a given task. The candidate will then be asked to review the PR, and provide feedback on it. This will allow us to evaluate the candidate's ability to understand the codebase, provide constructive feedback and good insights to get the task to the finish line.

## Input

If not provided in the invocation prompt, you should ask the user for the following information:

- Candidate's name
- A prompt describing the PR that the LLM agent should draft. This should be a clear and concise description of the task that the candidate will be asked to review.

## Step 1: fork the Polar repository to a private GitHub repository dedicated to the candidate

Run the script provided in this skill `.claude/skills/interview-task/scripts/fork-repository` with the candidate's name as an argument. This will create a private repository for the candidate.

The name of the candidate should be slugified (lowercase, ASCII, spaces replaced with hyphens) to be used in the repository name.

**Example**

- Candidate's name: François Voron

```bash
.claude/skills/interview-task/scripts/fork-repository francois-voron
```

## Step 2: create a branch for the PR

Run the script provided in this skill `.claude/skills/interview-task/scripts/setup-remote` with the candidate's slug and the branch name as arguments. This will add a remote pointing to the candidate's fork, fetch it, create the branch, and push it to the remote. The branch name should be descriptive of the task.

**Example**

```bash
.claude/skills/interview-task/scripts/setup-remote francois-voron add-new-feature
```

## Step 3: make changes to the codebase using LLM agent

Use an LLM agent to draft a PR in the candidate's repository. The PR should be based on the prompt provided by the user. The LLM agent should create one or more commits that implement the changes described in the prompt.

## Step 4: create a pull request

Once the changes have been made, push the changes and create a pull request in the candidate's repository. The PR should be titled and described in a way that clearly communicates the changes that were made.

```bash
git push && gh pr create --title "Add new feature" --body "This PR adds a new feature that allows users to do X, Y, and Z."
```

## Step 5: add a comment to the PR asking the candidate to review it

Post a comment to this PR following the template below, asking the candidate to review the PR and provide feedback on it.

```md
Hi <candidate>,

We have created this PR as part of our interview process. We would like you to review the changes and provide feedback on it. Please take your time to understand the codebase, and provide constructive feedback and good insights to get the task to the finish line.

## Expected Outcome

- A clear understanding of the changes made in the PR
- Constructive feedback on the implementation, including any potential issues or improvements that could be made
- A discussion on how to get the task to the finish line, including any additional changes that may be needed to complete the task

We **don't** expect you to actually implement the changes.

## Next Steps

Post your feedback as a comment on this PR, and we will review it together during our next interview session.
```

Command to post the comment:

```bash
gh pr comment <pr-number> --body '<body>'
```
