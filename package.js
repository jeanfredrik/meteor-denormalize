Package.describe({
  name: 'jeanfredrik:denormalize',
  version: '0.0.1',
  summary: 'Provides simple methods for common denormalization tasks',
  // URL to the Git repository containing the source code for this package.
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('jeanfredrik:denormalize');
  api.addFiles('denormalize-tests.js');
});
