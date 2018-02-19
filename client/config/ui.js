import {RocketChat} from 'meteor/rocketchat:lib';

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

RocketChat.callbacks.add('enter-room', () => {
	Meteor.call('chatpal.config.get', (err, config) => {
		if (err) {
			RocketChat.TabBar.updateButton('message-search', {
				i18nTitle: 'Search_Messages',
				icon: 'magnifier',
				template: 'messageSearch'
			});
		} else if (config.chatpalActivated) {
			RocketChat.TabBar.updateButton('message-search', {
				i18nTitle: 'CHATPAL_SEARCH',
				icon: 'chatpal',
				template: 'ChatpalSearch'
			});
		}
	});
}, RocketChat.callbacks.priority.MEDIUM);
