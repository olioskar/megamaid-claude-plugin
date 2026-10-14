function loadConfig(path) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

module.exports = { loadConfig };
