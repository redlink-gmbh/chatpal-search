import toastr from 'toastr';

Template.ChatpalAdmin.onDestroyed(function() {
	Meteor.clearTimeout(this.timeout);
});

Template.ChatpalAdmin.onCreated(function() {

	this.loadingConfig = new ReactiveVar(true);

	this.validated = new ReactiveVar(false);
	this.config = new ReactiveVar({
		backendtype:'cloud',
		docs_per_page: 5,
		dateformat: 'MMM Do',
		timeformat: 'H:mm A',
		language: 'none',
		batchsize: 24,
		timeout: 10000,
		headerstring: ''
	});

	this.messagesIndexed = new ReactiveVar(0);
	this.usersIndexed = new ReactiveVar(0);
	this.roomsIndexed = new ReactiveVar(0);
	this.indexingRunning = new ReactiveVar(false);
	this.enabled = new ReactiveVar(false);

	Meteor.call('chatpal.config.get', (err, config) => {
		//overwrite default settings
		if (!err && config) {

			config.apikey = this.data.key() || config.apikey;
			config.backendtype = this.data.type() || config.backendtype;

			this.config.set(config);

			this.loadingConfig.set(false);
		}

		//check if existing key is valid
		this.validate(this.config.get().apikey);
	});

	this.getStats = () => {
		Meteor.call('chatpal.search.stats', (err, stats) => {
			if(err) console.error(err);

			if(!stats.enabled) {
				this.enabled.set(false);
			} else {
				this.enabled.set(true);
				this.messagesIndexed.set(stats.numbers.messages);
				this.usersIndexed.set(stats.numbers.users);
				this.roomsIndexed.set(stats.numbers.rooms);
				this.indexingRunning.set(stats.running);
			}

			this.timeout = Meteor.setTimeout(() => {
				this.getStats();
			}, 5000);
		});
	};

	/**
	 * Test if an apikey is valid
	 * @param apikey
	 */
	this.validate = (apikey) => {
		if (!apikey) {
			this.validated.set(false);
		} else {
			Meteor.call('chatpal.utils.validatekey', apikey, (err, data) => {
				if (err) {
					console.error(err);
					this.validated.set(false);
				} else {
					this.validated.set(data);
				}
			});
		}
	};

	this.reindex = () => {

		this.indexingRunning.set(true);

		Meteor.call('chatpal.utils.reindex', (err) => {
			if (err) {
				console.error(err);
				toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_CANNOT_REINDEX'));
			}
		});
	};

	this.renewKey = (apikey) => {
		Meteor.call('chatpal.utils.renewkey', apikey, (err, key) => {
			if (err) {
				console.error(err);
				toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_CANNOT_RENEW_KEY'));
			} else if (key) {
				const config = this.config.get();
				config.apikey = key;
				this.config.set(config);
				this.save(config);
			} else {
				toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_CANNOT_RENEW_KEY'));
			}
		});
	};

	this.parseHeaders = (header_string) => {
		const headers = {};
		const sh = header_string.split('\n');
		sh.forEach(function(d) {
			const ds = d.split(':');
			if (ds.length !== 2 || ds[0].trim() === '') {
				throw new Error();
			}
			headers[ds[0]] = ds[1];
		});
		return headers;
	};

	this.save = (config) => {

		this.indexingRunning.set(true);

		//check preconditions
		if (config.backendtype === 'onsite' && (!config.baseurl || !config.baseurl.match(/^https?:\/\/.+/))) { return toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_BASEURL_NOT_VALID')); }

		if (config.backendtype === 'cloud' && (!config.apikey || !this.validated.get())) { return toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_CONFIG_CANNOT_BE_STORED')); }

		if (config.backendtype === 'onsite') {
			try {
				//parse headers
				config.headers = (config.headerstring && config.headerstring.trim() !== '') ? this.parseHeaders(config.headerstring.trim()) : {};
			} catch (e) {
				return toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_HEADERS_ARE_NOT_WELL_FORMATED'));
			}
		}

		//store config
		Meteor.call('chatpal.config.set', config, (err) => {
			if (err) {
				console.error(err);
				return toastr.error(TAPi18n.__('CHATPAL_MSG_ERROR_APIKEY_NOT_VALID'));
			}

			toastr.info(TAPi18n.__('CHATPAL_MSG_INFO_CONFIG_STORED_SUCCESSFULLY'));
		});
	};

	this.getStats();

});

Template.ChatpalAdmin.events({
	'submit form'(e, t) {
		e.preventDefault();
		t.save({
			backendtype: t.config.get().backendtype,
			baseurl: e.target.baseurl ? e.target.baseurl.value : undefined,
			apikey: e.target.apikey ? e.target.apikey.value : undefined,
			docs_per_page: e.target.docs_per_page.value || t.config.get().docs_per_page,
			dateformat: (e.target.dateformat.value && e.target.dateformat.value !== '') ? e.target.dateformat.value : t.config.get().dateformat,
			timeformat: (e.target.timeformat.value && e.target.timeformat.value !== '') ? e.target.timeformat.value : t.config.get().timeformat,
			language: e.target.language.value,
			batchsize: e.target.batchsize.value || t.config.get().batchsize,
			timeout: e.target.timeout.value || t.config.get().timeout,
			headerstring:  e.target.headerstring ? e.target.headerstring.value : undefined
		});
	},
	'click .chatpal-newkey'(e, t) {
		e.preventDefault();
		t.renewKey($(e.currentTarget).parent().find('input').val());
	},
	'click .reindex'(e, t) {
		e.preventDefault();
		t.reindex();
	},
	'change .chatpal-admin-type'(e, t) {
		const config = t.config.get();
		config.backendtype = e.currentTarget.value;
		t.config.set(config);
	},
	'input .chatpal-api-key-input'(e, t) {
		t.validate(e.target.value);
	}
});

Template.ChatpalAdmin.helpers({
	config() {
		return Template.instance().config.get();
	},
	validated() {
		return Template.instance().validated.get();
	},
	numOfUsers() {
		return Template.instance().usersIndexed.get();
	},
	numOfRooms() {
		return Template.instance().roomsIndexed.get();
	},
	numOfMessages() {
		return Template.instance().messagesIndexed.get();
	},
	indexingRunning() {
		return Template.instance().indexingRunning.get();
	},
	enabled() {
		return Template.instance().enabled.get();
	},
	loadingConfig() {
		return Template.instance().loadingConfig.get();
	}
});
