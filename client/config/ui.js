Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return true;
		}
	});

	Meteor.call('chatpal.config.get', (err, config) => {
		// switch the search template if Chatpal is activated
		if (!err && config && config.enabled) {
			RocketChat.TabBar.updateButton('message-search', {
				i18nTitle: 'CHATPAL_SEARCH',
				icon: 'chatpal',
				template: 'ChatpalSearch'
			});
		}
	});
});
