/* globals SystemLogger */
const Future = Npm.require('fibers/future');
const moment = Npm.require('moment');

class SmartiBackendUtils {

	static getQueryParameterString(text, page, pagesize, filters) {
		return `?sort=time%20desc&fl=id,message_id,meta_channel_id,user_id,time,message,type&hl=true&hl.fl=message&df=message&q=${ encodeURIComponent(text) }&start=${ (page-1)*pagesize }&rows=${ pagesize }`;
	}

	static alignResponse(result) {
		const docs = [];
		result.response.forEach(function(doc) {
			docs.push({
				type: doc.type,
				subtype: 'c',
				room: doc.meta_channel_id[0],
				id: doc.message_id,
				text: doc.message,
				highlight_text: result.highlighting[doc.id] ? result.highlighting[doc.id].message[0] : undefined,
				user: doc.user_id,
				date: doc.time
			});
		});

		return {
			numFound: result.meta.numFound,
			start: result.meta.start,
			docs
		};
	}

}

/**
 * The chatpal search service calls solr and returns result
 * ========================================================
 */
class ChatpalSearchService {

	constructor(url) {
		this.baseUrl = url;
		this.backendUtils = SmartiBackendUtils;
		//console.log('Init chatpal with url %s', url);
	}

	_getUserData(user_id) {
		const user = RocketChat.models.Users.findById(user_id).fetch();
		if (user && user.length > 0) {
			return {
				name: user[0].name,
				username: user[0].username
			};
		} else {
			return {
				name: 'Unknown',
				username: user_id
			};
		}
	}

	_getRoomData(room_id) {
		const room = RocketChat.models.Rooms.findOneByIdOrName(room_id);

		let type_symbol = '#';
		let link_path = 'channel';

		if (room) {
			switch (room.t) {
				case 'd': type_symbol = '@';break;
				case 'r': type_symbol = '?';link_path = 'request';break;
			}
		}

		return {
			name: room ? room.name : room_id,
			type_symbol,
			link_path
		};
	}

	_getDateStrings(date) {
		const d = moment(date);
		return {
			date: d.format(RocketChat.settings.get('CHATPAL_DATE_FORMAT')),
			time: d.format(RocketChat.settings.get('CHATPAL_TIME_FORMAT'))
		};
	}

	_searchAsync(text, page, pagesize, filters, callback) {

		const self = this,
			headers = {},
			extraHeader = RocketChat.settings.get('CHATPAL_EXTRA_HEADER');
		if (extraHeader && extraHeader !== '') {
			const kv = extraHeader.split(/\s*:\s*/, 2);
			headers[kv[0]] = kv[1];
		}

		HTTP.call('GET', this.baseUrl + SmartiBackendUtils.getQueryParameterString(text, page, pagesize, filters), {
			headers: headers
		}, (err, data) => {
			if (err) {
				callback(err);
			} else if (data.statusCode === 200) {
				const result = this.backendUtils.alignResponse(JSON.parse(data.content));

				result.docs.forEach(function(doc) {
					doc.user_data = self._getUserData(doc.user);
					doc.date_strings = self._getDateStrings(doc.date);
					doc.room_data = self._getRoomData(doc.room);
				});
				callback(null, result);
			} else {
				callback(data);
			}
		});
	}

	_pingAsync(callback) {

		HTTP.call('GET', `${ this.baseUrl }?q=*:*&rows=0`, {}, (err, data) => {
			if (err) {
				callback(err);
			} else if (data.statusCode === 200) {
				callback(null);
			} else {
				callback(data);
			}
		});
	}

	search(text, page, pagesize, filters) {
		const fut = new Future();

		SystemLogger.info('chatpal search: ', this.baseUrl, text, page, pagesize, filters);

		const bound_callback = Meteor.bindEnvironment(function(err, res) {
			if (err) {
				fut.throw(err);
			} else {
				fut.return(res);
			}
		});

		this._searchAsync(text, page, pagesize, filters, bound_callback);
		return fut.wait();
	}

	ping() {
		const fut = new Future();

		SystemLogger.info('chatpal ping');

		const bound_callback = Meteor.bindEnvironment(function(err, res) {
			if (err) {
				fut.throw(err);
			} else {
				fut.return(res);
			}
		});

		this._pingAsync(bound_callback);
		return fut.wait();
	}
}

// Reload on settings change
// =========================

let chatpalSearchService = new ChatpalSearchService('');

RocketChat.settings.get('CHATPAL_BASEURL', function(key, value) {
	//if configuration is already set
	chatpalSearchService = new ChatpalSearchService(value);
});

RocketChat.models.Settings.findById('CHATPAL_BASEURL').observeChanges({
	added(n, v) {
		chatpalSearchService = new ChatpalSearchService(v.value);
	},
	changed(n, v) {
		chatpalSearchService = new ChatpalSearchService(v.value);
	},
	removed() {
		chatpalSearchService = new ChatpalSearchService('');
	}
});

/**
 * Add the service methods to meteor
 * =================================
 */
Meteor.methods({
	'chatpal.search'(text, page, pagesize, filters) {
		return chatpalSearchService.search(text, page, pagesize, filters);
	}
});

Meteor.methods({
	'chatpal.ping'() {
		return chatpalSearchService.ping();
	}
});
