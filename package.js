Package.describe({
	name: 'chatpal:search',
	version: '0.0.1',
	summary: 'Chatpal search connector',
	git: ''
	//,documentation: 'README.md'
});

//https://docs.meteor.com/api/packagejs.html

Package.onUse(function(api) {
	api.use([
		'ecmascript',
		'templating',
		'rocketchat:lib'
	]);

	api.addFiles([
		'client/config/client-config.js',
		'client/style/style.css',
		'client/template/search.html',
		'client/template/search.js'
	], 'client');

	api.addFiles(['server/config/config.js',
		'server/service/search_service.js'
	], 'server');
});

Npm.depends({
	moment: '2.19.2'
});
