/* globals SystemLogger */
import {Chatpal} from '../base/backend.js';
import _ from 'underscore';

const Future = Npm.require('fibers/future');
const moment = Npm.require('moment');

class ChatpalIndexer {

	constructor() {
		this.baseUrl = Chatpal.Backend.baseurl;
		this.httpOptions = _.clone(Chatpal.Backend.httpOptions);
		this.language = Chatpal.Backend.language || 'none';//TODO
		this._messages = RocketChat.models.Messages.model;
		this.bootstrap();
	}

	_listMessages(start_date, end_date, start, rows) {
		return this._messages.find({ts:{$gt: new Date(start_date), $lt: new Date(end_date)}}, {skip:start, limit:rows}).fetch();
	}

	_existsDataOlderThan(date) {
		return this._messages.find({_updatedAt:{$lt: new Date(date)}}, {limit:1}).fetch().length > 0;
	}

	_clear() {
		console.debug('Chatpal: Clear Index');
		HTTP.call('GET', Chatpal.Backend.baseurl + Chatpal.Backend.clearpath, this.httpOptions.data);
		this.finished = false;
	}

	_index(last_date) {

		console.debug(`Chatpal: Index ${ last_date }`);

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
					solrDocs.push({
						id: m._id,
						room: m.rid,
						text: m.msg,
						user: m.u._id,
						date: m._updatedAt
					});
				});

				this.httpOptions.data = solrDocs;

				HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }?`, this.httpOptions);

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

				console.log('Indexed:', this.report);

				this._run(this.report.last_date, fut);

			}, Chatpal.Backend.config.timeout);
		} else if (this._break) {
			console.log('Chatpal: stopped bootstrap');
			fut.return();
		} else {
			this.finished = true;
			console.log('Chatpal: finished bootstrap');
			fut.return();
		}
	}

	continue() {
		const fut = new Future();

		if (!this.finished) {
			console.debug('Chatpal: Continue Bootstrapping');
			this._run(this.report.last_date, fut);
		} else {
			console.debug('Chatpal: Bootstrapping already finished');
			fut.return();
		}

		return fut;
	}

	bootstrap() {

		console.debug('Chatpal: bootstrap');

		this._clear();

		const fut = new Future();
		const last_date = new Date().valueOf();

		console.log(`exists older data than: ${ last_date }? ${ this._existsDataOlderThan(last_date) }`);

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

		console.log('start search service', Chatpal.Backend);

		if (this.enabled && Chatpal.Backend.refresh) {
			this.indexer = new ChatpalIndexer();
		} else if (this.indexer) {
			this.indexer.continue();
		} else {
			this.indexer = new ChatpalIndexer();//TODO reindex when restart rocketchat?
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

	_searchAsync(text, page, filters, callback) {

		const self = this;
		HTTP.call('GET', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.searchpath }${ this._getQueryParameterString(text, page, filters) }`, Chatpal.Backend.httpOptions, (err, data) => {
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

				result.pageSize = Chatpal.Backend.config.docs_per_page;

				callback(null, result);
			} else {
				callback(data);
			}
		});
	}

	/*
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
	}*/

	index(m) {
		if (this.enabled) {
			HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, Chatpal.Backend.httpOptions, {data:{
				id: m._id,
				room: m.rid,
				text: m.msg,
				user: m.u._id,
				date: m._updatedAt
			}});
		}
	}

	search(text, page, filters) {
		const fut = new Future();

		SystemLogger.info('chatpal search: ', this.baseUrl, text, page, filters);

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
