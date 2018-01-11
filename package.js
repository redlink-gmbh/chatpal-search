Package.describe({
	name: 'chatpal:search',
	version: '0.0.1',
	summary: 'Chatpal search connector',
	git: 'https://github.com/redlink-gmbh/chatpal-search',
	documentation: 'README.md'
});

Package.onUse(function(api) {
	api.use([
		'ecmascript',
		'templating',
		'rocketchat:lib',
		'kadira:flow-router',
		'http',
		'meteorhacks:inject-initial',
		'rocketchat:logger'
	]);

	api.addFiles('server/asset/pal.png', 'server', {isAsset:true});
	api.addFiles('server/asset/chatpal-icons.svg', 'server', {isAsset:true});

	api.addFiles([
		'client/config/i18n.js',
		'client/config/route.js',
		'client/config/ui.js',
		'client/style/style.css',
		'client/template/tac.html',
		'client/template/admin.html',
		'client/template/admin.js',
		'client/template/apikey.html',
		'client/template/apikey.js',
		'client/template/search.html',
		'client/template/search.js'
	], 'client');

	api.addFiles(['server/config/config.js',
		'server/base/backend.js',
		//'server/service/bot_service.js',
		'server/service/search_service.js',
		'server/method/methods.js'
	], 'server');
});

Npm.depends({
	moment: '2.19.2'
});
