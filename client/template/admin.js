import toastr from 'toastr';

Template.ChatpalAdmin.onCreated(function() {

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

	Meteor.call('chatpal.config.get', (err, config) => {
		//overwrite default settings
		if (!err && config) {

			config.apikey = this.data.key() || config.apikey;
			config.backendtype = this.data.type() || config.backendtype;

			this.config.set(config);
		}

		//check if existing key is valid
		this.validate(this.config.get().apikey);
	});

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
			headerstring:  e.target.headerstring.value
		});
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
	}
});
