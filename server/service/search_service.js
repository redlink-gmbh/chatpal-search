/* globals SystemLogger */
import {Chatpal} from '../config/config';

const Future = Npm.require('fibers/future');
const moment = Npm.require('moment');

class ChatpalIndexer {

	constructor() {
		this.baseUrl = Chatpal.Backend.baseurl;
		this.language = Chatpal.Backend.language || 'none';//TODO
		this.gap = 86400000; //one day
		this._messages = RocketChat.models.Messages.model;
		this.bootstrap();
	}

	_listMessages(start_date, end_date, start, rows) {
		return this._messages.find({ts:{$gt: new Date(start_date), $lt: new Date(end_date)}}, {skip:start, limit:rows}).fetch();
	}

	_existsDataOlderThan(date) {
		return this._messages.find({_updatedAt:{$lt: new Date(date)}}, {limit:1}).fetch().length > 0;
	}

	_index(last_date) {

		const report = {
			start_date: last_date,
			last_date: last_date - this.gap,
			number: 0
		};

		let hasNext = true;
		const step = 10;
		const rows = step;
		let start = 0;
		while (hasNext) {
			const messages = this._listMessages(report.last_date, last_date, start, rows);

			const solrDocs = [];

			if (messages.length > 0) {

				messages.forEach(function(m) {
					solrDocs.push({
						id: m._id,
						room: m.rid,
						text: m.msg,
						user: m.u._id,
						date: m._updatedAt
					});
				});

				HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }?commitWithin=1000`, {data:solrDocs});

				report.number += messages.length;

				start += step;
			} else {
				hasNext = false;
			}

		}
		return report;
	}

	stop() {
		this._break = true;
	}

	bootstrap() {
		const fut = new Future();
		const last_date = new Date().valueOf();

		console.log(`exists older data than: ${ last_date }? ${ this._existsDataOlderThan(last_date) }`);

		const run = (last_date) => {
			if (this._existsDataOlderThan(last_date) && !this._break) {
				Meteor.setTimeout(() => {
					const report = this._index(last_date);

					console.log('Indexed:', report);

					run(report.last_date);

				}, 1000);
			} else if (this._break) {
				console.log('Chatpal: stopped bootstrap');
				fut.return();
			} else {
				console.log('Chatpal: finished bootstrap');
				fut.return();
			}
		};

		run(last_date);

		return fut;
	}

}

/**
 * The chatpal search service calls solr and returns result
 * ========================================================
 */
class ChatpalSearchService {

	constructor() {
		this.start();
	}

	start() {
		this.enabled = Chatpal.Backend.enabled;

		console.log('start search service', Chatpal.Backend);

		if (this.enabled && Chatpal.Backend.refresh) {
			this.indexer = new ChatpalIndexer();
		}
	}

	stop() {
		if (this.enabled && this.indexer) {
			this.indexer.stop();
		}
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

	_getSubscription(room_id, user_id) {
		return RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(room_id, user_id);
	}

	_getDateStrings(date) {
		const d = moment(date);
		return {
			date: d.format(RocketChat.settings.get('CHATPAL_DATE_FORMAT') || 'MMM Do'),
			time: d.format(RocketChat.settings.get('CHATPAL_TIME_FORMAT') || 'H:mm A')
		};
	}

	_getAccessFiler(user) {
		const rooms = RocketChat.models.Subscriptions.find({'u._id': user._id}).fetch();
		return rooms.length > 0 ? `&fq=room:(${ rooms.map(room => room.rid).join(' OR ') })` : '';
	}

	_getQueryParameterString(text, page, pagesize, /*filters*/) {
		return `?q=${ encodeURIComponent(text) }&start=${ (page-1)*pagesize }&rows=${ pagesize }${ this._getAccessFiler(Meteor.user()) }`;
	}

	_alignResponse(result) {
		const res = result.response;
		res.docs.forEach(function(doc) {
			if (result.highlighting && result.highlighting[doc.id]) {
				doc.highlight_text = result.highlighting[doc.id].text[0];
			} else {
				doc.highlight_text = doc.text;
			}
		});
		return res;
	}

	_searchAsync(text, page, pagesize, filters, callback) {

		const self = this;
		HTTP.call('GET', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.searchpath }${ this._getQueryParameterString(text, page, pagesize, filters) }`, ChatpalSearchService._httpOptions, (err, data) => {
			if (err) {
				callback(err);
			} else if (data.statusCode === 200) {
				const result = this._alignResponse(JSON.parse(data.content));
				SystemLogger.debug(JSON.stringify(data, '', 2));

				const user = Meteor.user();

				result.docs.forEach(function(doc) {
					doc.user_data = self._getUserData(doc.user);
					doc.date_strings = self._getDateStrings(doc.date);
					doc.subscription = self._getSubscription(doc.room, user._id);
				});
				callback(null, result);
			} else {
				callback(data);
			}
		});
	}

	static get _httpOptions() { //TODO
		const options = {
			headers: Chatpal.Backend.headers
		};

		const authToken = RocketChat.settings.get('CHATPAL_AUTH_TOKEN');
		if (authToken) {
			options.headers['X-Auth-Token'] = authToken;
		}

		const basicAuth = RocketChat.settings.get('CHATPAL_BASIC_AUTH');
		if (basicAuth) {
			options.auth = basicAuth;
		}

		return options;
	}

	/*
	_pingAsync(callback) {

		HTTP.call('GET', `${ this.baseUrl }select?q=*:*&rows=0`, ChatpalSearchService._httpOptions, (err, data) => {
			if (err) {
				callback(err);
			} else if (data.statusCode === 200) {
				callback(null);
			} else {
				callback(data);
			}
		});
	}
	*/

	index(m) {
		if (this.enabled) {
			HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }?commitWithin=1000`, {data:{
				id: m._id,
				room: m.rid,
				text: m.msg,
				user: m.u._id,
				date: m._updatedAt
			}});
		}
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

		if (this.enabled) {
			this._searchAsync(text, page, pagesize, filters, bound_callback);
		} else {
			bound_callback('backend is currently not enabled');
		}
		return fut.wait();
	}

	/*
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
	 */
}

/**
 * Create Service
 * @type {ChatpalSearchService}
 */
Chatpal.service.SearchService = new ChatpalSearchService();

/**
 * Add Hook
 * ========
 */
RocketChat.callbacks.add('afterSaveMessage', function(m) {
	Chatpal.service.SearchService.index(m);
});
