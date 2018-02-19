import {SystemLogger} from 'meteor/rocketchat:logger';

export class ChatpalBackend {
	constructor(logger) {
		this.chatpalBaseUrl = 'https://beta.chatpal.io/v1';//https://api.chatpal.io';
		this.logger = logger;
		this.init();
	}

	tryToEnable(config) {
		this.enabled = config ? this._ping() : false;
		const maxTries = 10;
		const timeout = 10000;
		if (!this.enabled) {
			if (this.retryCounter <= maxTries) {
				const delay = this.retryCounter * timeout;
				this.logger.info('Couldn\'t enable Chatpal at', config.baseurl, 'trying again in', delay/1000, 'seconds');
				this.retryCounter++;
				Meteor.setTimeout(() => {
					this.tryToEnable(config);
				}, delay);
			} else {
				this.logger.info('Couldn\'t enable Chatpal at', config.baseurl, 'I gave up retrying, check the settings');
			}
		} else {
			this.logger.info('Chatpal enabled via', config.baseurl);
		}
	}

	init(config) {
		let storedConfig = RocketChat.models.Settings.findById('CHATPAL_CONFIG').fetch();

		storedConfig = (storedConfig && storedConfig.length === 1) ? storedConfig[0].value : undefined;

		this.refresh = false;

		if (config && !config.chatpalActivated) {
			// Chatpal has been disabled explicitly
			this.enabled = false;
		} else {
			if (config) {
				if (!storedConfig) {
					this.refresh = true;
				} else if (config.backendtype !== storedConfig.backendtype ||
					config.baseurl !== storedConfig.baseurl ||
					config.apikey !== storedConfig.apikey ||
					config.language !== storedConfig.language ||
					(config.chatpalActivated && config.chatpalActivated !== storedConfig.chatpalActivated)
				) {
					this.refresh = true;
				}
			}

			config = config || storedConfig;

			this.config = config;

			if (config && config.backendtype === 'cloud') {
				this.backendtype = config.backendtype;
				this.baseurl = this.chatpalBaseUrl;
				this.language = config.language;
				this.searchpath = '/search/search';
				this.updatepath = '/search/update';
				this.pingpath = '/search/ping';
				this.clearpath = '/search/clear';
				this.httpOptions = {
					headers: {
						'X-Api-Key': config.apikey
					}
				};
			} else if (config && config.backendtype === 'onsite') {
				this.backendtype = config.backendtype;
				this.baseurl = config.baseurl.endsWith('/') ? config.baseurl.slice(0, -1) : config.baseurl;
				this.language = config.language;
				this.searchpath = '/chatpal/search';
				this.updatepath = '/chatpal/update';
				this.pingpath = '/chatpal/ping';
				this.clearpath = '/chatpal/clear';
				this.httpOptions = {
					headers: config.headers
				};
			}

			this.retryCounter = 1;
			this.tryToEnable(config);
		}
	}

	_ping() {
		try {
			const response = HTTP.call('GET', this.baseurl + this.pingpath, this.httpOptions);//TODO set timeout
			return response.statusCode >= 200 && response.statusCode < 300;
		} catch (e) {
			return false;
		}
	}

	generateKey(email) {
		try {
			const response = HTTP.call('POST', `${ this.chatpalBaseUrl }/account`, {data: {email, tier: 'free'}});
			if (response.statusCode === 201) {
				return response.data.key;
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
	}

	renewKey(key) {
		try {
			const response = HTTP.call('POST', `${ this.chatpalBaseUrl }/account/key`, {headers: {'X-Api-Key': key}});
			if (response.statusCode === 201) {
				return response.data.key;
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
	}

	validateKey(key) {
		try {
			const response = HTTP.call('GET', `${ this.chatpalBaseUrl }/account/key`, {headers: {'X-Api-Key': key}});
			if (response.statusCode === 204) {
				return true;
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
	}
}


export const Chatpal = {
	models: {},
	service: {},
	Backend: new ChatpalBackend(SystemLogger)
};
