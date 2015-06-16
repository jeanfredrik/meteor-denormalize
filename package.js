Package.describe({
  name: 'jeanfredrik:denormalize',
  version: '0.1.0',
  summary: 'Provides simple methods for common denormalization tasks',
  git: 'https://github.com/jeanfredrik/meteor-denormalize.git',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');
  api.use(['mongo'], 'server');
  api.use('matb33:collection-hooks@0.7.13', 'server');
  api.use('dburles:collection-helpers@0.3.2', 'server');
  api.addFiles('methods/cacheDoc.js', 'server');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use(['mongo', 'autopublish', 'insecure']);
  api.use('jeanfredrik:denormalize');
  api.export(['Posts', 'Comments']);
  api.addFiles('denormalize-tests-server.js', 'server');
});
