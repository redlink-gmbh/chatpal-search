Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return true;
		}
	});

	RocketChat.TabBar.removeButton('message-search');
	RocketChat.TabBar.addButton({
		groups: ['channel', 'group', 'direct'],
		id: 'message-search',
		i18nTitle: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		template: 'ChatpalSearch',
		order: 1
	});
});
