FlowRouter.route('/admin/chatpal', {
	name: 'admin-chatpal',
	action(p, up) {
		return BlazeLayout.render('main', {
			center: 'pageSettingsContainer',
			pageTitle: t('Chatpal'),
			pageTemplate: 'ChatpalAdmin',
			key: up.key,
			type: up.type
		});
	}
});

FlowRouter.route('/admin/chatpal/api-key', {
	name: 'admin-chatpal-api-key',
	action() {
		return BlazeLayout.render('main', {
			center: 'pageSettingsContainer',
			pageTitle: t('Chatpal API KEY'),
			pageTemplate: 'ChatpalApiKey'
		});
	}
});
