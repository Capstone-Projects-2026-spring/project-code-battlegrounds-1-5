---
sidebar_position: 1
---

# Getting Started with Your Documentation Site

Welcome! This guide will help you get started with the documentation template, whether you're seeing this for the first time or already have it running.

## Getting the Template

If you haven't set up the template yet, here's how to get started:

### Step 1: Get the Template

You have several options to get the template:

#### Option A: GitHub Classroom (For CIS 4398 and 3296 Students)
If you're working on a class assignment, use the GitHub Classroom link provided by your instructor. This will automatically create your repository with the correct permissions and settings.

#### Option B: Use as Template (For Personal Projects)
1. Go to the [template repository](https://github.com/ApplebaumIan/tu-cis-4398-docs-template)
2. Click the green **"Use this template"** button
3. Select **"Create a new repository"**
4. Name your repository and make it public
5. Click **"Create repository from template"**

#### Option C: Create New Project with CLI

Create a new project with documentation included:

```bash
npx create-project-docs new my-project
cd my-project
```

#### Option D: Add to Existing Project

Add documentation to an existing project:

```bash
cd your-existing-project
npx create-project-docs add
```

### Step 2: Enable GitHub Pages

After creating your repository:

1. Go to your repository **Settings**
2. Scroll down to **Pages** section
3. Under "Source", select **"Deploy from a branch"**
4. Choose **"gh-pages"** branch (this will be created automatically later)
5. Click **Save**

## Development Environment Options

Now you have two main options for working with your documentation:

### Option 1: GitHub Codespaces (Recommended for Beginners)

GitHub Codespaces provides a cloud-based development environment that's ready to go:

1. **Open in Codespaces**: Go to your repository on GitHub and click the green "Code" button, then select "Codespaces"
2. **Wait for setup**: The environment will automatically install dependencies
3. **Start the development server**:

```bash
cd documentation
```

```bash
yarn start
```

4. **View your site**: Codespaces will provide a preview URL (usually shown in a popup)

:::mermaid

:::warning **Note**
Only you can see your Codespace and it's preview URL. To share your work, push changes to GitHub.
:::

### Option 2: Local Development

If you prefer working locally on your machine:

#### Prerequisites
- [Node.js](https://nodejs.org/en/download/) version 16 or above
- [Git](https://git-scm.com/downloads) for version control

#### Setup Steps

1. **Clone your repository**:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
```

2. **Navigate to the documentation folder**:

```bash
cd YOUR-REPO-NAME/documentation
```

3. **Install dependencies**:

```bash
yarn install
```

4. **Start the development server**:

```bash
yarn start
```

5. **View your site**: Open http://localhost:3000 in your browser

## Making Your First Edit

Let's make a quick edit to see how the live reload works:

1. Open `docs/intro.mdx` in your editor
2. Make a small change to the text
3. Save the file
4. Watch your browser automatically refresh with the changes!

## Automatic Deployment

**This is the best part.** Your site deploys automatically:

1. **Make changes** to your documentation
2. **Commit and push** to the `main` branch
3. **GitHub Actions automatically builds and deploys** your site
4. **View your live site** at: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

No manual deployment needed!

## Key Files and Folders

Here's what's important in your documentation structure:

- **`docs/`** - Your main documentation content
- **`tutorial/`** - The tutorial pages you're reading now
- **`src/pages/`** - Custom React pages (like the homepage)
- **`static/`** - Static assets (images, files)
- **`docusaurus.config.js`** - Main configuration file

## Next Steps

1. **Customize your site title and branding** in `docusaurus.config.js`
2. **Set up environment variables** for the contributors section (see [Set Environment Variables](/tutorial/tutorial-basics/set-environment-variables))
3. **Add your project content** by editing files in the `docs/` folder
4. **Deploy your changes** - commits to the main branch automatically deploy via GitHub Actions

## Need Help?

- **Git basics**: Check out [GitHub's Git Handbook](https://guides.github.com/introduction/git-handbook/)
- **Markdown guide**: See [Markdown Features](/tutorial/tutorial-basics/markdown-features)
- **Docusaurus docs**: Visit [docusaurus.io](https://docusaurus.io/docs) for advanced features

Happy documenting! 🚀
