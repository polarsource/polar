'use strict'

const enforceGitHubCapitalization = require('./enforce-github-capitalization');
const plugin = { rules: { 'enforce-github-capitalization': enforceGitHubCapitalization } };
module.exports = plugin;
