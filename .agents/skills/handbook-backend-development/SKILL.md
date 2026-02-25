---
name: handbook-backend-development
description: A skill to add a new entry in the section "Backend Development" of the Polar Handbook. Those entries are there to explain concepts, tooling and best practices related to backend development, and are meant to be read by Polar developers.
user-invocable: true
allowed-tools: Read Grep Write
---

# Handbook - Backend Development

This skill explains the process to add a new entry in the section "Backend Development" of the Polar Handbook. Those entries are there to explain concepts, tooling and best practices related to backend development, and are meant to be read by Polar developers.

The user should explain which concept they want to explain in the new entry, and the skill will guide them through the process of creating the file, exploring the code base to find relevant information, and writing the content of the entry.

## Step 1: Create the file

Create an MDX file in `handbook/backend-development` with a name that reflects the concept you want to explain. For example, if you want to explain how the distributed lock mechanism works, you could name the file `distributed-lock.mdx`.

Follow the following template for the content of the file:

```mdx
---
title: "Title of the entry"
description: "Short description of the entry"
---

Summary of the concept you want to explain.

## When to use this concept

## How to use this concept

## How it works
```

The three sections "When to use this concept", "How to use this concept" and "How it works under the hood" are here to structure the content of the entry. The first section should explain in which situations the concept is useful, the second section should explain how to use the concept in practice, and the third section should explain how the concept works under the hood, with technical details and references to the code base.

## Step 2: Explore and draft the content of the entry

To write the content of the entry, you will need to explore the code base to find relevant information about the concept you want to explain. Use it to fill the three sections of the entry with accurate and detailed information. You can also add code snippets, diagrams, or any other type of content that you think is relevant to explain the concept.

## Step 3: Ask for feedback

Once you have a draft of the entry, ask for feedback from the user. If you have any doubts about the content, ask for clarification. You can also ask for feedback on the structure and the clarity of the entry. The goal is to make sure that the entry is accurate, clear, and useful for Polar developers.
