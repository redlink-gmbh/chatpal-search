import toastr from 'toastr';

Template.ChatpalAdmin.onCreated(function() {

	this.backend = new ReactiveVar('cloud');
	this.apikey = new ReactiveVar();
	this.baseurl = new ReactiveVar();
	this.validated = new ReactiveVar(false);

	Meteor.call('chatpal.config.get', (err, config) => {
		//overwrite default settings
		if (!err && config) {
			this.backend.set(config.backendtype);
			this.apikey.set(config.apikey);
			this.baseurl.set(config.baseurl);
		}

		//overwrite settings with query params
		if (this.data.key()) { this.apikey.set(this.data.key()); }
		if (this.data.type()) { this.backend.set(this.data.type()); }

		//check if existing key is valid
		if (this.apikey.get()) { this.validate(this.apikey.get()); }
	});

	/**
	 * Test if an apikey is valid
	 * @param apikey
	 */
	this.validate = (apikey) => {
		Meteor.call('chatpal.utils.validatekey', apikey, (err, data) => {
			if (err) {
				console.error(err);
				this.validated.set(false);
			} else {
				this.validated.set(data);
			}
		});
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

			toastr.info(TAPi18n.__('error-chatpal-config-stored-successfull'));
		});
	};

});

Template.ChatpalAdmin.events({
	'submit form'(e, t) {
		e.preventDefault();
		t.save({
			backendtype: t.backend.get(),
			baseurl: e.target.baseurl ? e.target.baseurl.value : undefined,
			apikey: e.target.apikey ? e.target.apikey.value : undefined
		});
	},
	'change .chatpal-admin-type'(e, t) {
		t.backend.set(e.currentTarget.value);
	},
	'input .chatpal-api-key-input'(e, t) {
		t.validate(e.target.value);
	}
});

Template.ChatpalAdmin.helpers({
	backend() {
		return Template.instance().backend.get();
	},
	apikey() {
		return Template.instance().apikey.get();
	},
	baseurl() {
		return Template.instance().baseurl.get();
	},
	validated() {
		return Template.instance().validated.get();
	}
});
