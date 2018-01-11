import {Chatpal} from '../base/backend.js';
import _ from 'underscore';

const Future = Npm.require('fibers/future');
const moment = Npm.require('moment');

let logger;

if (Meteor.isServer) {
	logger = new Logger('ChatpalSearchService', {});
}

class ChatpalIndexer {

	constructor(clear) {
		this._messages = RocketChat.models.Messages.model;
		if (clear) {
			this._clear();
		}
		this.bootstrap();
	}

	_listMessages(start_date, end_date, start, rows) {
		return this._messages.find({ts:{$gt: new Date(start_date), $lt: new Date(end_date)}}, {skip:start, limit:rows}).fetch();
	}

	_existsDataOlderThan(date) {
		return this._messages.find({_updatedAt:{$lt: new Date(date)}}, {limit:1}).fetch().length > 0;
	}

	_clear() {
		logger && logger.debug('Chatpal: Clear Index');
		HTTP.call('GET', Chatpal.Backend.baseurl + Chatpal.Backend.clearpath, Chatpal.Backend.httpOptions);
	}

	_index(last_date) {

		logger && logger.debug(`Chatpal: Index ${ last_date.toLocaleString() }`);

		const report = {
			start_date: last_date,
			last_date: last_date - Chatpal.Backend.config.batchsize * 3600000,
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
					const doc = {
						id: m._id,
						room: m.rid,
						user: m.u._id,
						created: m.ts,
						updated: m._updatedAt
					};

					doc[`text_${ Chatpal.Backend.language }`] = m.msg;

					solrDocs.push(doc);
				});



				const data = {data:solrDocs};

				_.extend(data, Chatpal.Backend.httpOptions);

				HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }?`, data);

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

	_run(last_date, fut) {
		if (this._existsDataOlderThan(last_date) && !this._break) {
			Meteor.setTimeout(() => {
				this.report = this._index(last_date);

				logger && logger.info('Indexed:', this.report);

				this._run(this.report.last_date, fut);

			}, Chatpal.Backend.config.timeout);
		} else if (this._break) {
			logger && logger.info('Chatpal: stopped bootstrap');
			fut.return();
		} else {
			logger && logger.info('Chatpal: finished bootstrap');
			fut.return();
		}
	}

	_getlastdate() {
		const result = HTTP.call('GET', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.searchpath }?q=*:*&rows=1&sort=created%20asc`, Chatpal.Backend.httpOptions);

		if (result.data.response.numFound > 0) {
			return new Date(result.data.response.docs[0].created).valueOf();
		} else {
			return new Date().valueOf();
		}
	}

	bootstrap() {

		logger && logger.info('Chatpal: bootstrap');

		const fut = new Future();

		const last_date = this._getlastdate();

		this._run(last_date, fut);

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

		logger && logger.info('start search service');

		if (this.enabled) {
			this.indexer = new ChatpalIndexer(Chatpal.Backend.refresh);
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
			date: d.format(Chatpal.Backend.config.dateformat),
			time: d.format(Chatpal.Backend.config.timeformat)
		};
	}

	_getAccessFiler(user) {
		const rooms = RocketChat.models.Subscriptions.find({'u._id': user._id}).fetch();
		return rooms.length > 0 ? `&fq=room:(${ rooms.map(room => room.rid).join(' OR ') })` : '';
	}

	_getQueryParameterString(text, page, /*filters*/) {
		const pagesize = Chatpal.Backend.config.docs_per_page;
		return `?q=${ encodeURIComponent(text) }&hl.fl=text_${ Chatpal.Backend.language }&df=text_${ Chatpal.Backend.language }&start=${ (page-1)*pagesize }&rows=${ pagesize }${ this._getAccessFiler(Meteor.user()) }`;
	}

	_alignResponse(result) {
		const res = result.response;
		res.docs.forEach(function(doc) {
			if (result.highlighting && result.highlighting[doc.id]) {
				doc.highlight_text = result.highlighting[doc.id][`text_${ Chatpal.Backend.language }`][0];
			} else {
				doc.highlight_text = doc.text;
			}
		});
		return res;
	}

	_searchAsync(text, page, filters, callback) {

		const self = this;

		const query = `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.searchpath }${ this._getQueryParameterString(text, page, filters) }`;

		logger && logger.debug(`query: ${ query }`, Chatpal.Backend.httpOptions);

		HTTP.call('GET', query, Chatpal.Backend.httpOptions, (err, data) => {

			if (err) {
				if (err.response.statusCode === 400) {
					callback({status:err.response.statusCode, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_BAD_QUERY'});
				} else {
					callback({status:err.response.statusCode, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_FAILED'});
				}
			} else {
				const result = this._alignResponse(JSON.parse(data.content));

				const user = Meteor.user();

				result.docs.forEach(function(doc) {
					doc.user_data = self._getUserData(doc.user);
					doc.date_strings = self._getDateStrings(doc.created);
					doc.subscription = self._getSubscription(doc.room, user._id);
				});

				result.pageSize = Chatpal.Backend.config.docs_per_page;

				callback(null, result);
			}

		});
	}

	index(m) {
		if (this.enabled) {
			const data = {data:{
				id: m._id,
				room: m.rid,
				user: m.u._id,
				created: m.ts,
				updated: m._updatedAt
			}};

			data.data[`text_${ Chatpal.Backend.language }`] = m.msg;

			_.extend(data, Chatpal.Backend.httpOptions);

			HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, data);
		}
	}

	search(text, page, filters) {
		const fut = new Future();

		const bound_callback = Meteor.bindEnvironment(function(err, res) {
			if (err) {
				fut.throw(err);
			} else {
				fut.return(res);
			}
		});

		if (this.enabled) {
			this._searchAsync(text, page, filters, bound_callback);
		} else {
			bound_callback('backend is currently not enabled');
		}
		return fut.wait();
	}
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
