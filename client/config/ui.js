import {RocketChat} from 'meteor/rocketchat:lib';

Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return RocketChat.authz.hasAllPermission('chatpal-admin');
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

RocketChat.callbacks.add('enter-room', () => {
	Meteor.call('chatpal.config.get', (err, config) => {
		if (!err && config.chatpalActivated) {
			RocketChat.TabBar.updateButton('message-search', {
				i18nTitle: 'CHATPAL_SEARCH',
				icon: 'chatpal',
				template: 'ChatpalSearch'
			});
		} else {
			RocketChat.TabBar.updateButton('message-search', {
				i18nTitle: 'Search_Messages',
				icon: 'magnifier',
				template: 'messageSearch'
			});
		}
	});
}, RocketChat.callbacks.priority.MEDIUM);
