const fs = require('node:fs');

const targetPath = 'src/environments/environment.prod.ts';
let content = fs.readFileSync(targetPath, 'utf8');

const escapeForTsSingleQuotedString = (value) =>
  String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const replaceEnvValue = (key, rawValue) => {
  const safeValue = escapeForTsSingleQuotedString(rawValue ?? '');
  const pattern = new RegExp(`${key}:\\s*'[^']*'`);
  content = content.replace(pattern, `${key}: '${safeValue}'`);
};

replaceEnvValue('apiBaseUrl', process.env.API_BASE_URL || '');
replaceEnvValue('mediaProductBaseUrl', process.env.MEDIA_PRODUCT_BASE_URL || '');
replaceEnvValue('siteUrl', process.env.SITE_URL || '');

fs.writeFileSync(targetPath, content);
