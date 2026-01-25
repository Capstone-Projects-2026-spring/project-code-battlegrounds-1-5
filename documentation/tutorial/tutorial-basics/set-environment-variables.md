---
sidebar_position: 6
---

# Set Environment Variables

This guide explains how to set the `PROJECT_NAME` and `ORG_NAME` environment variables needed for the contributors section to work properly.

## Why These Variables Are Needed

The contributors component uses these environment variables to:
- Generate the correct GitHub repository URL
- Display contributor avatars from contrib.rocks
- Link to your project's contributors page

## Setting Environment Variables

### macOS and Linux (including GitHub Codespaces)

#### Temporary (Current Session Only)

Open your terminal and run:

```bash
export ORG_NAME="your-github-username"
```

```bash
export PROJECT_NAME="your-repository-name"
```

For example:

```bash
export ORG_NAME="facebook"
```

```bash
export PROJECT_NAME="docusaurus"
```

#### Permanent (All Sessions)

Add the exports to your shell profile file:

**For Bash (~/.bashrc or ~/.bash_profile):**

```bash
echo 'export ORG_NAME="your-github-username"' >> ~/.bashrc
```

```bash
echo 'export PROJECT_NAME="your-repository-name"' >> ~/.bashrc
```

```bash
source ~/.bashrc
```

**For Zsh (~/.zshrc):**

```bash
echo 'export ORG_NAME="your-github-username"' >> ~/.zshrc
```

```bash
echo 'export PROJECT_NAME="your-repository-name"' >> ~/.zshrc
```

```bash
source ~/.zshrc
```

### Windows

#### Command Prompt (Temporary)

```cmd
set ORG_NAME=your-github-username
```

```cmd
set PROJECT_NAME=your-repository-name
```

#### Command Prompt (Permanent)

```cmd
setx ORG_NAME "your-github-username"
```

```cmd
setx PROJECT_NAME "your-repository-name"
```

#### PowerShell (Temporary)

```powershell
$env:ORG_NAME="your-github-username"
```

```powershell
$env:PROJECT_NAME="your-repository-name"
```

#### PowerShell (Permanent)

```powershell
[Environment]::SetEnvironmentVariable("ORG_NAME", "your-github-username", "User")
```

```powershell
[Environment]::SetEnvironmentVariable("PROJECT_NAME", "your-repository-name", "User")
```

#### Windows GUI Method

1. Right-click "This PC" or "Computer" and select "Properties"
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Add `ORG_NAME` with your GitHub username as the value
6. Click "New" again and add `PROJECT_NAME` with your repository name as the value
7. Click "OK" to save

## Verifying Your Setup

After setting the variables, verify they're correctly set:

### macOS/Linux/GitHub Codespaces:

```bash
echo $ORG_NAME
```

```bash
echo $PROJECT_NAME
```

### Windows Command Prompt:

```cmd
echo %ORG_NAME%
```

```cmd
echo %PROJECT_NAME%
```

### Windows PowerShell:

```powershell
echo $env:ORG_NAME
```

```powershell
echo $env:PROJECT_NAME
```

## Development vs Production

### For Local Development

The environment variables you set locally will be used when running:

```bash
cd documentation
```

```bash
npm start
```

or

```bash
yarn start
```

### For GitHub Actions (Production)

The deployment workflow automatically sets these variables using:
- `ORG_NAME`: Extracted from `GITHUB_REPOSITORY` (the part before the `/`)
- `PROJECT_NAME`: Extracted from `GITHUB_REPOSITORY` (the part after the `/`)

No manual configuration is needed for GitHub Actions deployment.

## Troubleshooting

### Contributors Image Not Loading

If you see "Contributors Not Available":

1. **Check your variables are set correctly** using the verification commands above
2. **Restart your development server** after setting environment variables
3. **Make sure your repository is public** - contrib.rocks requires public repositories
4. **Verify the repository exists** and has contributors

### Common Issues

- **Variables not persisting**: Make sure you added them to the correct shell profile file
- **Case sensitivity**: Environment variable names are case-sensitive
- **Spaces in values**: Wrap values with spaces in quotes
- **New terminal required**: Open a new terminal window after setting permanent variables

## Example

For the repository `https://github.com/facebook/docusaurus`:
- `ORG_NAME` should be `facebook`
- `PROJECT_NAME` should be `docusaurus`

The contributors component will then display avatars from:

```
https://contrib.rocks/image?repo=facebook/docusaurus
```
