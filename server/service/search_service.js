/* globals SystemLogger */
/* globals ChatSubscription */
import {Chatpal} from '../config/config';
import {Mongo} from 'meteor/mongo';

const Future = Npm.require('fibers/future');
const moment = Npm.require('moment');

class SmartiBackend {

	getQueryParameterString(text, page, pagesize/*, filters*/) {
		return `?sort=time%20desc&fl=id,message_id,meta_channel_id,user_id,time,message,type&hl=true&hl.fl=message&df=message&q=${ encodeURIComponent(text) }&start=${ (page - 1) * pagesize }&rows=${ pagesize }`;
	}

	alignResponse(result) {
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

	bootstrap() {
		console.log('no bootstrap required for smarti backend');
	}

	index() {
		//nothing to do
	}

	setBaseUrl(url) {
		this.baseUrl = url;
	}

	getBaseUrl() {
		return this.baseUrl;
	}
}

class ChatpalBackend {

	constructor() {
		this.gap = 86400000; //one day
		this._index_log = new Mongo.Collection('chatpal_search_indexlog');
		this._messages = RocketChat.models.Messages.model;
		this._rooms = RocketChat.models.Rooms.model;
	}

	_getAccessFiler(user) {
		const rooms = RocketChat.models.Subscriptions.find({'u._id': user._id}).fetch();
		return rooms.length > 0 ? `&fq=room:(${ rooms.map(room => room.rid).join(' OR ') })` : '';
	}

	getQueryParameterString(text, page, pagesize, filters) {
		//console.log(`?q=${ encodeURIComponent(text) }&start=${ (page-1)*pagesize }&rows=${ pagesize }${ this._getAccessFiler(Meteor.user()) }`);
		return `?q=${ encodeURIComponent(text) }&start=${ (page-1)*pagesize }&rows=${ pagesize }${ this._getAccessFiler(Meteor.user()) }`;
	}

	alignResponse(result) {
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

	_listMessages(room, start_date, end_date, start, rows) {
		return this._messages.find({rid:room, ts:{$gt: new Date(start_date), $lt: new Date(end_date)}}, {skip:start, limit:rows}).fetch();
	}

	_existsDataOlderThan(date) {
		return this._messages.find({_updatedAt:{$lt: new Date(date)}}, {limit:1}).fetch().length > 0;
	}

	_index(last_date) {

		const report = {
			last_date: last_date - this.gap,
			number: 0
		};

		const rooms = this._rooms.find({ts:{$lt: new Date(last_date), $gt: new Date(report.last_date)}}).fetch();

		rooms.forEach((room) => {
			let hasNext = true;
			const step = 10;
			const rows = step;
			let start = 0;
			while (hasNext) {
				const messages = this._listMessages(room._id, report.last_date, last_date, start, rows);

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

					const result = HTTP.call('POST', `${ this.baseUrl }update/json/docs?commitWithin=1000`, {data:solrDocs});

					report.number += messages.length;

					start += step;
				} else {
					hasNext = false;
				}

			}
		});

		return report;
	}

	bootstrap() {

		const report = this._index_log.find({}, {limit:1, sort:{last_date:-1}}).fetch();

		let last_date = new Date().valueOf();

		if (report && report.length !== 0) {
			last_date = new Date(report[0].last_date).valueOf();
		}

		console.log(`exists older data than: ${ last_date }? ${ this._existsDataOlderThan(last_date) }`);

		while (this._existsDataOlderThan(last_date)) {

			const report = this._index(last_date);

			this._index_log.insert(report);

			//delay();
			last_date = report.last_date;
		}
	}

	index(m) {
		const result = HTTP.call('POST', `${ this.baseUrl }update/json/docs?commitWithin=1000`, {data:{
			id: m._id,
			room: m.rid,
			text: m.msg,
			user: m.u._id,
			date: m._updatedAt
		}});
	}

	setBaseUrl(url) {
		this.baseUrl = url;
	}

	getBaseUrl() {
		return this.baseUrl;
	}
}

class BackendFactory {

	static getInstance() {

		const name = 'chatpal'; //TODO Meteor.settings.CHATPAL_BACKEND;

		switch (name) {
			case 'smarti': return new SmartiBackend();
			default: return new ChatpalBackend();
		}
	}

}

/**
 * The chatpal search service calls solr and returns result
 * ========================================================
 */
class ChatpalSearchService {

	constructor() {
		this.backendUtils = BackendFactory.getInstance();
		this.searchHandler = 'search';
	}

	setBaseUrl(url) {
		this.baseUrl = url;
		this._pingAsync((err) => {
			if (err) {
				console.log(`cannot ping url ${ url }`);
			} else {
				this.backendUtils.setBaseUrl(url);
				this._bootstrapIndex();
			}
		});
	}

	_bootstrapIndex() {
		this.backendUtils.bootstrap();
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

		const user = Meteor.user();

		return RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(room_id, user._id);
	}

	_getDateStrings(date) {
		const d = moment(date);
		return {
			date: d.format(RocketChat.settings.get('CHATPAL_DATE_FORMAT')),
			time: d.format(RocketChat.settings.get('CHATPAL_TIME_FORMAT'))
		};
	}

	_searchAsync(text, page, pagesize, filters, callback) {

		const self = this;
		HTTP.call('GET', this.backendUtils.getBaseUrl() + this.searchHandler + this.backendUtils.getQueryParameterString(text, page, pagesize, filters), ChatpalSearchService._httpOptions, (err, data) => {
			if (err) {
				callback(err);
			} else if (data.statusCode === 200) {
				const result = this.backendUtils.alignResponse(JSON.parse(data.content));
				SystemLogger.debug(JSON.stringify(data, '', 2));
				result.docs.forEach(function(doc) {
					doc.user_data = self._getUserData(doc.user);
					doc.date_strings = self._getDateStrings(doc.date);
					doc.subscription = self._getSubscription(doc.room);
				});
				callback(null, result);
			} else {
				callback(data);
			}
		});
	}

	static get _httpOptions() {
		const options = {};

		const authToken = RocketChat.settings.get('CHATPAL_AUTH_TOKEN');
		if (authToken) {
			options.headers = {'X-Auth-Token': authToken};
		}

		const basicAuth = RocketChat.settings.get('CHATPAL_BASIC_AUTH');
		if (basicAuth) {
			options.auth = basicAuth;
		}

		return options;
	}

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

	index(message, room) {
		this.backendUtils.index(message, room);
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

	stop() {
		//SystemLogger.info('Chatpal Service stopped');
	}
}

// Reload on settings change
// =========================

Chatpal.service.SearchService = new ChatpalSearchService();

RocketChat.settings.get('CHATPAL_BASEURL', (id, value)=>{
	Chatpal.service.SearchService.setBaseUrl(value);
});

/**
 * Add the service methods to meteor
 * =================================
 */
Meteor.methods({
	'chatpal.search'(text, page, pagesize, filters) {
		return Chatpal.service.SearchService.search(text, page, pagesize, filters);
	}
});

Meteor.methods({
	'chatpal.ping'() {
		return Chatpal.service.SearchService.ping();
	}
});

/**
 * Add Hook
 * ========
 */
RocketChat.callbacks.add('afterSaveMessage', function(m, r) {
	Chatpal.service.SearchService.index(m, r);
});
