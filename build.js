const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const yamlPath = path.join(__dirname, 'syntaxes', 'dascript.tmLanguage.yaml');
const jsonPath = path.join(__dirname, 'syntaxes', 'dascript.tmLanguage.json');

try {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const jsonContent = yaml.load(yamlContent);
    const jsonString = JSON.stringify(jsonContent, null, 2);

    // Write without BOM
    fs.writeFileSync(jsonPath, jsonString, { encoding: 'utf8' });

    console.log('✓ Grammar built successfully');
} catch (error) {
    console.error('Error building grammar:', error.message);
    process.exit(1);
}
