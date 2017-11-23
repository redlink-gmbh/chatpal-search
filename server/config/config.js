Meteor.startup(() => {
	RocketChat.settings.addGroup('Chatpal', function() {
		this.section('CHATPAL_SEARCH', function() {
			this.add('CHATPAL_BASEURL', '', {
				type: 'string',
				public: true,
				i18nLabel: 'CHATPAL_BASEURL'
			});

			this.add('CHATPAL_PAGESIZE', 5, {
				type: 'int',
				public: true,
				i18nLabel: 'CHATPAL_PAGESIZE'
			});

			this.add('CHATPAL_TIME_FORMAT', 'H:mm A', {
				type: 'string',
				public: true,
				i18nLabel: 'CHATPAL_TIME_FORMAT'
			});

			this.add('CHATPAL_DATE_FORMAT', 'MMM Do', {
				type: 'string',
				public: true,
				i18nLabel: 'CHATPAL_DATE_FORMAT'
			});
		});
	});
});
