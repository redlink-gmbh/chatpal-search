FlowRouter.route('/admin/chatpal', {
	name: 'admin-chatpal',
	action(p, up) {
		return BlazeLayout.render('main', {
			center: 'ChatpalAdmin',
			pageTitle: t('Chatpal'),
			key: up.key,
			type: up.type
		});
	}
});

FlowRouter.route('/admin/chatpal/api-key', {
	name: 'admin-chatpal-api-key',
	action() {
		return BlazeLayout.render('main', {
			center: 'ChatpalApiKey',
			pageTitle: t('Chatpal API KEY')
		});
	}
});
