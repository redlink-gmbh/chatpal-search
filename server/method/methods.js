/**
 * Add the service methods to meteor
 * =================================
 */
import {Chatpal} from '../config/config';
import {ChatpalBackend} from '../config/config';

Meteor.methods({
	'chatpal.search.search'(text, page, pagesize, filters) {
		return Chatpal.service.SearchService.search(text, page, pagesize, filters);
	}
});

Meteor.methods({
	'chatpal.config.set'(config) {
		//stop all services
		Object.keys(Chatpal.service).forEach((key) => {
			Chatpal.service[key].stop();
		});

		//test settings
		Chatpal.Backend = new ChatpalBackend(config);

		if (!Chatpal.Backend.enabled) { throw new Error('cannot enable chatpal backend'); }

		//make settings
		RocketChat.models.Settings.createWithIdAndValue('CHATPAL_CONFIG', config);

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
