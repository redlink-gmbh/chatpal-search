/**
 * Add the service methods to meteor
 * =================================
 */
import {Chatpal} from '../base/backend';

Meteor.methods({
	'chatpal.search.search'(text, page, filters) {
		return Chatpal.service.SearchService.search(text, page, filters);
	}
});

Meteor.methods({
	'chatpal.config.set'(config) {
		//stop all services
		Object.keys(Chatpal.service).forEach((key) => {
			Chatpal.service[key].stop();
		});

		//test settings
		Chatpal.Backend.init(config);

		if (!Chatpal.Backend.enabled) { throw new Error('cannot enable chatpal backend'); }

		//make settings
		RocketChat.models.Settings.updateValueById('CHATPAL_CONFIG', config);

		//start all services
		Object.keys(Chatpal.service).forEach((key) => {
			Chatpal.service[key].start();
		});
	}
});

Meteor.methods({
	'chatpal.config.get'() {
		const config = RocketChat.models.Settings.findById('CHATPAL_CONFIG').fetch();
		return (config && config.length > 0) ? config[0].value : undefined;
	}
});

Meteor.methods({
	'chatpal.utils.validatekey'(key) {
		return key === '123';//TODO
	}
});
