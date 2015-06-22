Package.describe({
  name: 'jeanfredrik:denormalize',
  version: '0.7.0',
  summary: 'Provides simple methods for common denormalization tasks',
  git: 'https://github.com/jeanfredrik/meteor-denormalize.git',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');

  //Required core packages
  api.use([
    'mongo',
    'underscore',
  ], 'server');

  //Required 3rd party packages
  api.use([
    'matb33:collection-hooks@0.7.13',
  ], 'server');

  //Weak 3rd party packages
  api.use([
    'dburles:collection-helpers@1.0.0',
    'aldeed:collection2@2.0.0',
  ], {where: 'server', weak: true});

  api.addFiles('denormalize-common.js');
  api.addFiles('denormalize-hooks.js', 'server');

  api.addFiles('methods/cacheDoc.js', 'server');
  api.addFiles('methods/cacheCount.js', 'server');
  api.addFiles('methods/cacheField.js', 'server');

  api.export(['Denormalize']);
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use(['mongo', 'autopublish', 'insecure', 'underscore']);

  //Weak 3rd party packages
  api.use([
    'dburles:collection-helpers@1.0.0',
    'aldeed:collection2@2.0.0',
  ]);

  api.use('jeanfredrik:denormalize');

  api.export(['Posts', 'Comments', 'Denormalize']);

  api.addFiles('test-utils.js', 'server');
  api.addFiles('denormalize-tests-server.js', 'server');
});
