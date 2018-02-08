Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return true;
		}
	});

	RocketChat.TabBar.updateButton('message-search', {
		i18nTitle: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		template: 'ChatpalSearch'
	});
});
