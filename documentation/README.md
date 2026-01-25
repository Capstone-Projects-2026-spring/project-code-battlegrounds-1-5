# Website

This website is built using [Docusaurus 3](https://docusaurus.io/), a modern static website generator.

## CLI Usage

### Add documentation to an existing project

```bash
npx create-project-docs add
```

Add documentation to a specific directory:

```bash
npx create-project-docs add --path ../my-project
```

### Create a new project with documentation

```bash
npx create-project-docs new my-project
cd my-project
```

### Options

- `--force` - Overwrite existing documentation folder
- `--skip-install` - Skip running yarn install
- `--help` - Show help

### Installation

```
$ yarn
```

### Local Development

```
$ PROJECT_NAME=your-project-name yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ PROJECT_NAME=your-project-name yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

Using SSH:

```
$ USE_SSH=true yarn deploy
```

Not using SSH:

```
$ GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

