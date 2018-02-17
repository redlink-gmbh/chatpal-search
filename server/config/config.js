/* globals Inject */
Meteor.startup(() => {

	// we need to provide an initial configuration which is loaded even if invalid
	// lateron, we'll only accept valid configurations
	const initialConfig = {
		chatpalActivated: false,
		backendtype: 'cloud',
		apikey: '',
		docs_per_page: 5,
		dateformat: 'MMM Do',
		timeformat: 'H:mm A',
		language: 'none',
		batchsize: 24,
		timeout: 10000,
		headerstring: '',
		baseurl: ''
	};

	const settings = RocketChat.models.Settings.findById('CHATPAL_CONFIG').fetch();
	if (!settings[0]) {
		RocketChat.models.Settings.createWithIdAndValue('CHATPAL_CONFIG', initialConfig);
	}

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
	//TODO add message fetch with SyncedCron
});

Inject.rawBody('chatpal-icons', Assets.getText('server/asset/chatpal-icons.svg'));
