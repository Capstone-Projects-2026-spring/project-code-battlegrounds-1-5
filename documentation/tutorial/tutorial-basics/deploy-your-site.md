---
sidebar_position: 7
---

# Deploy your site

This template includes **automatic deployment** to GitHub Pages using GitHub Actions. Every time you push changes to the main branch, your site is automatically built and deployed!

## Automatic Deployment (Recommended)

Your documentation site is configured for **zero-configuration deployment**:

### How it works

1. **Push to main branch**: Make changes and commit them to the `main` branch
2. **GitHub Actions triggers**: The deploy workflow automatically starts
3. **Site builds and deploys**: Your updated documentation appears on GitHub Pages

### Viewing your deployed site

Your site is automatically available at:
```
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

### Monitoring deployments

You can watch the deployment process:

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. View the "Deploy Docs" workflow runs
4. Click on any run to see detailed logs

The deployment workflow (`deploy.yml`) handles:
- Installing dependencies with `yarn install`
- Building the site for production
- Deploying to GitHub Pages using the GitHub Actions bot
- Setting up environment variables automatically

## Manual Build and Test (Optional)

If you want to test your site locally before deploying:

### Build your site

Build your site **for production**:

```bash
yarn build
```

The static files are generated in the `build` folder.

### Test your production build

Test your production build locally:

```bash
yarn serve
```

The `build` folder is now served at `http://localhost:3000/`.

## Troubleshooting Deployment

### Common issues:

- **Deployment failing**: Check the Actions tab for error logs
- **Site not updating**: Ensure you're pushing to the `main` branch
- **Contributors not showing**: Set up environment variables locally (see [Set Environment Variables](/tutorial/tutorial-basics/set-environment-variables))
- **Build errors**: Run `yarn build` locally to test before pushing

### GitHub Pages setup

Make sure GitHub Pages is enabled:

1. Go to your repository **Settings**
2. Scroll to **Pages** section
3. Set source to "Deploy from a branch"
4. Select the `gh-pages` branch (created automatically by the workflow)

## What happens during deployment

The GitHub Actions workflow:

1. **Checks out your code** from the main branch
2. **Installs dependencies** using yarn
3. **Extracts repository info** for the contributors component
4. **Builds the static site** with production optimizations
5. **Deploys to GitHub Pages** using the built-in GitHub token

No manual deployment steps needed - just push your changes! 🚀
