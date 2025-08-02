# GitHub Releases Watcher

GitHub Releases Watcher is a simple Node.js application that monitors specified GitHub repositories for new releases and sends email notifications when a new release is detected. It stores the latest release information in a local JSON file.

## Features

- Monitors multiple GitHub repositories for new releases.
- Sends email notifications for new releases.
- Stores the latest release information per repository in a local JSON file.
- Easy to configure via a YAML file.
- **Pattern filtering**: Configure regex patterns to filter which releases trigger notifications while still tracking all releases.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/en/) (v18 or later recommended)
- [pnpm](https://pnpm.io/) (for package management)

## Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/Double-oxygeN/github-releases-watcher.git
    cd github-releases-watcher
    ```

2. **Install dependencies:**

    ```bash
    pnpm install
    ```

## Configuration

1. **Create your configuration file:**

    Copy the example configuration file and rename it to `config.yaml`:

    ```bash
    cp config.example.yaml config.yaml
    ```

2. **Edit `config.yaml`:**

    Open `config.yaml` in your text editor and fill in the details.

### Repository Configuration

You can configure repositories in two ways:

#### Basic Configuration (All releases trigger notifications)

```yaml
repos:
  "owner/repository": {}
```

#### Advanced Configuration with Pattern Filtering

```yaml
repos:
  "microsoft/vscode":
    pattern: "^[A-Za-z]+ [0-9]+$"  # Only releases like "January 2024"
  "facebook/react":
    pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+"  # Semantic versioning like "18.2.0 (June 14, 2022)"
  "other/repo": {}  # No pattern - all releases trigger notifications
```

**Pattern Behavior:**

- When a `pattern` is specified, only releases whose titles match the regex pattern will trigger email notifications
- All releases (matching or not) are still saved to the JSON file and logged
- If no `pattern` is specified, all releases trigger notifications
- Use double backslashes (`\\`) to escape regex special characters in YAML

> [!IMPORTANT]
> `config.yaml` is ignored by Git (via `.gitignore`) to prevent sensitive information (like email passwords) from being committed to your repository.

## Usage

To run the application, use the following command:

```bash
pnpm run build && pnpm run start
```

This will:

1. Read your `config.yaml`.
2. Check for new releases for each configured repository.
3. Send an email notification if a new release is found and matches the configured pattern (if any).
4. Update the `data/releases.json` file with the latest release information (regardless of pattern matching).
5. Log any releases that don't match the pattern but were still tracked.

## Development

### Build

To build the TypeScript source code into JavaScript:

```bash
pnpm run build
```

### Lint

To check code style and potential errors:

```bash
pnpm run lint
```

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.
