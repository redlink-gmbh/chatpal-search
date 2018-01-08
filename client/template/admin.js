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
		timeout: 10000
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

	this.save = (config) => {
		//check preconditions
		if (config.backendtype === 'onsite' && (!config.baseurl || !config.baseurl.match(/^https?:\/\/.+/))) { return toastr.error(TAPi18n.__('error-chatpal-baseurl-not-valid')); }

		if (config.backendtype === 'cloud' && (!config.apikey || !this.validated.get())) { return toastr.error(TAPi18n.__('error-chatpal-apikey-not-valid')); }

		//store config
		Meteor.call('chatpal.config.set', config, (err) => {
			if (err) {
				console.error(err);
				return toastr.error(TAPi18n.__('error-chatpal-config-cannot-be-stored'));
			}

			toastr.info(TAPi18n.__('info-chatpal-config-stored-successfull'));
		});
	};

});

Template.ChatpalAdmin.events({
	'submit form'(e, t) {
		e.preventDefault();console.log(e.target.baseurl);
		t.save({
			backendtype: t.config.get().backendtype,
			baseurl: e.target.baseurl ? e.target.baseurl.value : undefined,
			apikey: e.target.apikey ? e.target.apikey.value : undefined,
			docs_per_page: e.target.docs_per_page.value || t.config.get().docs_per_page,
			dateformat: (e.target.dateformat.value && e.target.dateformat.value !== '') ? e.target.dateformat.value : t.config.get().dateformat,
			timeformat: (e.target.timeformat.value && e.target.timeformat.value !== '') ? e.target.timeformat.value : t.config.get().timeformat,
			language: e.target.language.value,
			batchsize: e.target.batchsize.value || t.config.get().batchsize,
			timeout: e.target.timeout.value || t.config.get().timeout
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
