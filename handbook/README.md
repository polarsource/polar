# Polar Handbook

This repository contains the Polar team handbook built with [Mintlify](https://mintlify.com/).

## 📝 Tech Notes

Tech notes are technical deep-dives, debugging stories, and engineering insights from the Polar team.

### Quick Start - Creating a New Tech Note

```bash
# Create a new tech note interactively
./tech-notes --new
```

This will guide you through:
- Setting the title and description
- Adding your name as author
- Optional tags for categorization
- Auto-generating the file with proper structure

### Other Commands

```bash
# Check if listing needs updating (great for CI)
./tech-notes --check

# Regenerate the tech notes listing
./tech-notes --fix

# Show help
./tech-notes --help
```

## 🏗️ Development

This handbook is built with Mintlify. Individual tech notes don't appear in the navigation - they're organized on the main tech notes page with the latest post featured prominently.

## 🤝 Contributing

To contribute a tech note, simply run `./tech-notes --new` and follow the prompts. The system will automatically handle formatting, dating, and listing updates.
