export class ChatpalBackend {
	constructor() {
		this.init();
	}

	init(config) {
		let storedConfig = RocketChat.models.Settings.findById('CHATPAL_CONFIG').fetch();

		storedConfig = (storedConfig && storedConfig.length === 1) ? storedConfig[0].value : undefined;

		if (config) {
			if (!storedConfig) {
				this.refresh = true;
			} else if (config.backendtype !== storedConfig.backendtype ||
				config.baseurl !== storedConfig.baseurl ||
				config.apikey !== storedConfig.apikey ||
				config.language !== storedConfig.language
			) { this.refresh = true; }
		}

		config = config || storedConfig;

		this.config = config;

		if (config && config.backendtype === 'cloud') {
			this.backendtype = config.backendtype;
			this.baseurl = 'https://api.chatpal.io';
			this.searchpath = '/search/query';
			this.updatepath = '/search/update';
			this.pingpath = '/account/key';
			this.clearpath = '/search/clear';
			this.httpOptions = {
				headers: {
					'X-Client-Key': config.apikey
				}
			};
		} else if (config && config.backendtype === 'onsite') {
			this.backendtype = config.backendtype;
			this.baseurl = config.baseurl.endsWith('/') ? config.baseurl.slice(0, -1) : config.baseurl;
			this.searchpath = '/search';
			this.updatepath = '/update/json/docs';
			this.pingpath = '/search?q=*:*&rows=0&facet=false';
			this.clearpath = '/update?stream.body=<delete><query>*:*</query></delete>&commit=true';
			this.headers = config.headers || {};
			this.httpOptions = {
				headers: config.headers || {}
			};
		}

		this.enabled = config ? this._ping() : false;
	}

	_ping() {
		try {
			const response = HTTP.call('GET', this.baseurl + this.pingpath, this.httpOptions);
			return response.statusCode === 200;
		} catch (e) {
			console.error(e);
			return false;
		}
	}
}


export const Chatpal = {
	models: {},
	service: {},
	Backend: new ChatpalBackend()
};