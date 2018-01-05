Meteor.startup(() => {

	/*
	Meteor.defer(function() {
		if (!RocketChat.models.Users.db.findOneById('chatpal')) {
			RocketChat.models.Users.create({
				_id: 'chatpal',
				name: 'Chatpal',
				username: 'chatpal',
				status: 'online',
				statusDefault: 'online',
				utcOffset: 0,
				active: true,
				type: 'bot'
			});

			RocketChat.authz.addUserRoles('chatpal');

			const rs = RocketChatFile.bufferToStream(new Buffer(Assets.getBinary('server/asset/pal.png')));
			const fileStore = FileUpload.getStore('Avatars');
			fileStore.deleteByName('chatpal');

			const file = {
				userId: 'chatpal',
				type: 'image/png'
			};

			Meteor.runAsUser('chatpal', () => {
				fileStore.insert(file, rs, () => {
					return RocketChat.models.Users.setAvatarOrigin('chatpal', 'local');
				});
			});
		}
	});
	*/
});
export class ChatpalBackend {
	constructor(config) {

		this.refresh = !!config;

		config = config || RocketChat.models.Settings.findOneNotHiddenById('CHATPAL_CONFIG');

		this.enabled = !!config; //TODO ping

		if (config && config.backendtype === 'cloud') {
			this.baseurl = 'https://api.chatpal.io';
			this.searchpath = '/search/query';
			this.updatepath = '/search/update';
			this.headers = {'X-Client-Key':config.apikey};
		} else if (config && config.backendtype === 'onsite') {
			this.baseurl = config.baseurl.endsWith('/') ? config.baseurl.slice(0, -1) : config.baseurl;
			this.searchpath = '/search';
			this.updatepath = '/update/json/docs';
			this.headers = config.headers || {};
		}

	}
}


export const Chatpal = {
	models: {},
	service: {},
	Backend: new ChatpalBackend()
};
