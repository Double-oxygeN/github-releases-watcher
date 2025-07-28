# GitHub Releases Watcher

GitHub Releases Watcher is a simple Node.js application that monitors specified GitHub repositories for new releases and sends email notifications when a new release is detected. It stores the latest release information in a local JSON file.

## Features

- Monitors multiple GitHub repositories for new releases.
- Sends email notifications for new releases.
- Stores the latest release information per repository in a local JSON file.
- Easy to configure via a YAML file.

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
3. Send an email notification if a new release is found (only the latest one per repository).
4. Update the `data/releases.json` file with the latest release information.

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
