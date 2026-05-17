---
name: fix-sentry
description: Analyze and fix issues reported by Sentry in the Polar codebase.
user-invocable: true
allowed-tools: Bash(gh:*) Bash(git:*) logfire_polar* sentry_polar* github*
---

You're responsible for analyzing and fixing issues reported by Sentry in the Polar codebase. This involves investigating the Sentry reports, identifying the root causes of the issues, and implementing fixes to resolve them.

## Input

If not provided in the invocation prompt, you should ask the user for the a Sentry issue ID or a link to the Sentry issue. This will allow you to access the details of the issue and begin your analysis.

The Sentry organization ID of Polar is `4505046560538624` and its slug is `polar-sh`.

## Step 1: Analyze the Sentry issue

Using the sentry_polar tools, access the details of the Sentry issue provided by the user. This includes the error message, stack trace, and any additional context or metadata associated with the issue.

## Step 2: correlate with Logfire logs

Extract the `correlation_id` tag from the Sentry issue. If available, use it to search for related logs in Logfire using the logfire_polar tools. This can provide additional context and insights into the events leading up to the issue, helping you to further understand the root cause.

The clause will look like this: `attributes->>'correlation_id' = '<correlation_id>'`

If any logs has `source_correlation_id`, query those logs as well.

## Step 3: Search source code

Look up for relevant code in the codebase using the information from the Sentry issue and the Logfire logs. This may involve searching for specific error messages, function names, or other relevant keywords in the codebase.

### Step 4: Analyze findings

Synthetize the information gathered from the Sentry issue, Logfire logs, and source code search to formulate a hypothesis about the root cause of the issue.

## Step 5: Implement a fix

**Important**: If your analysis indicates that the issue involves heavy architectural changes, or if you are unsure about the best way to implement a fix, do not proceed with implementing a fix on your own. Instead, open an issue on `polarsource/polar` with your findings and analysis.

### Step 5.1: Create a worktree

Always start by creating a git worktree for the work you are about to do. This will allow you to keep your changes organized and separate from the main codebase until they are ready to be merged. Run the following script:

```bash
./dev/create-woktree <branch-name>
```

This will create a worktree and prepare the environment for you to work on the issue. Make sure to replace `<branch-name>` with a descriptive name for your branch, using only **lowercase letters, digits, and underscores**. The worktree is created in the `./worktrees` directory, and you can navigate to it using `cd ./worktrees/<branch-name>`.

**IMPORTANT**: From now on, all your changes and commands should be executed within the context of the worktree you just created. This ensures that your changes are isolated and can be easily managed.

```bash
cd ./worktrees/<branch-name>
```

### Step 5.2: Implement a fix

Based on your analysis, implement a fix to resolve the issue. This may involve modifying existing code, adding new code, or making configuration changes.

Check linting, type checking, and tests before committing your changes, as detailed in AGENTS.md.

### Step 5.3: Commit your changes

Commit your changes to the branch you created in the worktree. Make sure to write a clear and descriptive commit message that explains the changes you made and the reason for those changes.

### Step 5.4: Open a pull request

Open a pull request on `polarsource/polar` using github tools, detailing your analysis, adding relevant links to the Sentry issue and Logfire logs, and describing the changes you made to fix the issue.
