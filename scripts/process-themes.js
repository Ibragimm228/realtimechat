const fs = require('fs');
const path = require('path');

const themesDir = path.join(__dirname, '../themes');
const outputFile = path.join(__dirname, '../src/lib/themes.ts');

if (!fs.existsSync(themesDir)) {
  console.log('Themes directory not found');
  process.exit(0);
}

const files = fs.readdirSync(themesDir).filter(f => f.endsWith('.md'));
const themes = {};

files.forEach(file => {
  const content = fs.readFileSync(path.join(themesDir, file), 'utf-8');
  const name = path.basename(file, '.md');
  
  const rootMatch = content.match(/:root\s*{([^}]*)}/);
  const darkMatch = content.match(/\.dark\s*{([^}]*)}/);

  if (rootMatch) {
    const lightVars = {};
    rootMatch[1].split(';').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (key && value) {
          lightVars[key] = value;
        }
      }
    });

    const darkVars = {};
    if (darkMatch) {
      darkMatch[1].split(';').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(':').trim();
          if (key && value) {
            darkVars[key] = value;
          }
        }
      });
    }

    themes[name] = {
      light: lightVars,
      dark: Object.keys(darkVars).length > 0 ? darkVars : lightVars // Fallback to light if no dark
    };
  }
});

const outputContent = `export type Theme = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

export const themes: Record<string, Theme> = ${JSON.stringify(themes, null, 2)};
`;

fs.writeFileSync(outputFile, outputContent);
console.log(`Generated ${Object.keys(themes).length} themes.`);

files.forEach(file => {
  fs.unlinkSync(path.join(themesDir, file));
});
console.log('Cleaned up theme files.');
