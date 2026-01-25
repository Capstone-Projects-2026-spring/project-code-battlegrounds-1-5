const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function fetchPackageInfo(packageName) {
  // Handle scoped packages
  const fetchName = packageName.replace('/', '%2f');
  try {
    const response = await fetch(`https://registry.npmjs.org/${fetchName}`);
    if (!response.ok) {
      console.error(`Failed to fetch package info for ${packageName}: ${response.statusText}`);
      return { description: 'Could not fetch description.', repository: { url: '' } };
    }
    const data = await response.json();
    return {
      description: data.description || 'No description available.',
      repository: data.repository,
    };
  } catch (error) {
    console.error(`Error fetching package info for ${packageName}:`, error);
    return { description: 'Could not fetch description.', repository: { url: '' } };
  }
}

function getRepoUrl(repo) {
  if (!repo || !repo.url) return 'N/A';
  let url = repo.url.replace(/^git\+/, '').replace(/\.git$/, '');
  if (url.startsWith('ssh://git@')) {
    url = `https://${url.substring(10)}`;
  }
  return `[View](${url})`;
}

async function generateDependenciesPage() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  let markdownContent = `import Contributors from '@site/src/components/Contributors';\n\n`;
  markdownContent += `# Contributors & Open Source Usage \n\n`;
  markdownContent += `This Docusaurus template was designed and Developed for the [Temple University CIS Capstone course](https://capstone.ianapplebaum.com). It is built on the shoulders of students, alumni, faculty, and amazing open source software. This page is automatically generated from the \`package.json\` file and provides a list of all the open source projects and plugins that make this template possible.\n\n`;
  // markdownContent += `\n## Template Contributors\n\n`;
  markdownContent += `<Contributors orgName="applebaumian" projectName="tu-cis-4398-docs-template"/>\n\n`;
  markdownContent += `We welcome contributions from Temple University students, and alumni! If you'd like to contribute, please:\n\n`;
  markdownContent += `1. Fork the [template repository](https://github.com/ApplebaumIan/tu-cis-4398-docs-template)\n`;
  markdownContent += `2. Create a feature branch\n`;
  markdownContent += `3. Submit a pull request\n\n`;
  markdownContent += `All contributors will be recognized here.\n\n`;

  markdownContent += `\n## Component Authors\n\n`;
  markdownContent += `The following components were created by Temple University students and alumni. Thank you for your contributions!\n\n`;
  markdownContent += `| Component | Author(s) |\n`;
  markdownContent += `|---|---|\n`;

  const componentsDir = path.join(__dirname, '..', 'src', 'components');
  const components = fs.readdirSync(componentsDir).filter(file => {
      const filePath = path.join(componentsDir, file);
      return fs.statSync(filePath).isDirectory();
  });

  for (const component of components) {
      const componentPath = path.join(componentsDir, component);
      try {
          const authorsOutput = execSync(`git log --pretty=format:"%an|%ae" -- "${componentPath}"`).toString().trim();
          const authorLines = [...new Set(authorsOutput.split('\n').filter(line => line))];

          const authors = await Promise.all(authorLines.reverse().map(async (line) => {
              const [name, email] = line.split('|');
              try {
                  const response = await fetch(`https://api.github.com/search/users?q=${email}+in:email`);
                  const data = await response.json();
                  if (data.items && data.items.length > 0) {
                      const user = data.items[0];
                      return `[${name}](${user.html_url})`;
                  }
              } catch (apiError) {
                  console.error(`Failed to fetch GitHub profile for ${email}: ${apiError.message}`);
              }
              return name; // Fallback to just the name
          }));

          markdownContent += `| ${component} | ${authors.join(', ')} |\n`;
      } catch (error) {
          console.error(`Could not find author for component ${component}: ${error.message}`);
          markdownContent += `| ${component} | Not available |\n`;
      }
  }

  markdownContent += `\n## Core Dependencies\n\n`;
  markdownContent += `| Package | Description | Repository |\n`;
  markdownContent += `|---|---|---|\n`;

  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (name === 'plugin-image-zoom') { // Special handling for git dependency
      markdownContent += `| \`${name}@${version}\` | Image zoom functionality | [View](https://github.com/flexanalytics/plugin-image-zoom) |\n`;
      continue;
    }
    const { description, repository } = await fetchPackageInfo(name);
    const repoUrl = getRepoUrl(repository);
    markdownContent += `| \`${name}@${version}\` | ${description} | ${repoUrl} |\n`;
  }

  markdownContent += `\n## Development Dependencies\n\n`;
  markdownContent += `| Package | Description | Repository |\n`;
  markdownContent += `|---|---|---|\n`;

  for (const [name, version] of Object.entries(packageJson.devDependencies)) {
    const { description, repository } = await fetchPackageInfo(name);
    const repoUrl = getRepoUrl(repository);
    markdownContent += `| \`${name}@${version}\` | ${description} | ${repoUrl} |\n`;
  }

  markdownContent += `## License\n\n`;
  markdownContent += `This template follows the licensing of its dependencies. Please refer to individual projects for their specific licenses.\n\n`;

  const outputDir = path.join(__dirname, '..', 'tutorial');
  const staticDir = path.join(__dirname, '..', 'static');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'open-source-usage.mdx'), markdownContent);
  fs.writeFileSync(path.join(staticDir, 'open-source-usage.mdx'), markdownContent);

    console.log('Successfully generated open-source-usage.mdx');
}

generateDependenciesPage();
