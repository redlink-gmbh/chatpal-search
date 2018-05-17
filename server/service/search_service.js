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
		this.running = true;
		this._messages = RocketChat.models.Messages.model;
		this.bootstrap(clear);
	}

	reindex() {
		if (!this.running) {
			this.bootstrap(true);
		}
	}

	static getIndexMessageDocument(m) {
		const doc = {
			id: `m_${ m._id }`,
			room: m.rid,
			user: m.u._id,
			created: m.ts,
			updated: m._updatedAt,
			type: 'CHATPAL_RESULT_TYPE_MESSAGE'
		};

		doc[`text_${ Chatpal.Backend.language }`] = m.msg;

		return doc;
	}

	static getIndexRoomDocument(r) {
		return {
			id: `u_${ r._id }`,
			room: r._id,
			created: r.createdAt,
			updated: r.lm ? r.lm : r._updatedAt,
			type: 'CHATPAL_RESULT_TYPE_ROOM',
			room_name: r.name,
			room_announcement: r.announcement,
			room_description: r.description,
			room_topic: r.topic
		};
	}

	static getIndexUserDocument(u) {
		return {
			id: `r_${ u._id }`,
			created: u.createdAt,
			updated: u._updatedAt,
			type: 'CHATPAL_RESULT_TYPE_USER',
			user_username: u.username,
			user_name: u.name,
			user_email: _.map(u.emails, (e) => { return e.address; })
		};
	}

	_listMessages(start_date, end_date, start, rows) {
		return this._messages.find({ts:{$gt: new Date(start_date), $lt: new Date(end_date)}, t:{$exists:false}}, {skip:start, limit:rows}).fetch();
	}

	_existsDataOlderThan(date) {
		return this._messages.find({ts:{$lt: new Date(date)}, t:{$exists:false}}, {limit:1}).fetch().length > 0;
	}

	_clear() {
		logger && logger.debug('Clear Index');

		const options = {data:{
			delete: {
				query: '*:*'
			},
			commit:{}
		}};

		_.extend(options, Chatpal.Backend.httpOptions);

		HTTP.call('POST', Chatpal.Backend.baseurl + Chatpal.Backend.clearpath, options);
	}

	_indexUsers() {

		logger && logger.debug('Index Users');

		const limit = 100;
		let skip = 0;
		let users = [];
		do {
			users = Meteor.users.find({}, {sort:{createdAt:1}, limit, skip}).fetch();
			skip += limit;

			const userDocs = [];

			users.forEach((u) => {
				if (u.active) {
					userDocs.push(ChatpalIndexer.getIndexUserDocument(u));
				}
			});

			const options = {data:userDocs};

			_.extend(options, Chatpal.Backend.httpOptions);

			const response = HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);

			logger && logger.debug(`index ${ userDocs.length } users`, Chatpal.Backend.httpOptions, response);

		} while (users.length > 0);
	}

	_indexRooms() {

		logger && logger.debug('Index Rooms');

		const limit = 100;
		let skip = 0;
		let rooms = [];
		do {
			rooms = RocketChat.models.Rooms.find({t:{$ne:'d'}}, {sort:{createdAt:1}, limit, skip}).fetch();
			skip += limit;

			const roomDocs = [];

			rooms.forEach((r) => {
				roomDocs.push(ChatpalIndexer.getIndexRoomDocument(r));
			});

			const options = {data:roomDocs};

			_.extend(options, Chatpal.Backend.httpOptions);

			const response = HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);

			logger && logger.debug(`index ${ roomDocs.length } rooms`, Chatpal.Backend.httpOptions, response);

		} while (rooms.length > 0);
	}

	_index(last_date) {

		logger && logger.debug(`Index ${ new Date(last_date).toISOString() }`);

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
					solrDocs.push(ChatpalIndexer.getIndexMessageDocument(m));
				});

				const options = {data:solrDocs};

				_.extend(options, Chatpal.Backend.httpOptions);

				const response = HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);

				logger && logger.debug(`index ${ solrDocs.length } messages`, Chatpal.Backend.httpOptions, response);

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

		this.running = true;

		if (this._existsDataOlderThan(last_date) && !this._break) {

			Meteor.setTimeout(() => {
				this.report = this._index(last_date);

				logger && logger.info(`Indexed ${ this.report.number } messages from ${ new Date(this.report.last_date).toISOString() } to ${ new Date(this.report.start_date).toISOString() }`);

				this._run(this.report.last_date, fut);

			}, Chatpal.Backend.config.timeout);
		} else if (this._break) {
			logger && logger.info('stopped bootstrap');
			this.running = false;
			fut.return();
		} else {

			//index users
			this._indexUsers();

			this._indexRooms();

			logger && logger.info('finished bootstrap');

			this.running = false;

			fut.return();
		}
	}

	_getlastdate() {
		const options = {
			params: {
				q:'*:*',
				rows:1,
				sort:'created asc',
				type: 'CHATPAL_RESULT_TYPE_MESSAGE'
			}
		};

		_.extend(options, Chatpal.Backend.httpOptions);

		try {
			const result = HTTP.call('POST', Chatpal.Backend.baseurl + Chatpal.Backend.searchpath, options);

			if (result.data.response.numFound > 0) {
				return new Date(result.data.response.docs[0].created).valueOf();
			} else {
				return new Date().valueOf();
			}
		} catch (e) {
			logger && logger.warn('cannot get latest date - complete reindex is triggered');
			return new Date().valueOf();
		}
	}

	bootstrap(clear) {

		logger && logger.info('bootstrap');

		const fut = new Future();

		let last_date = new Date().valueOf();

		if (clear) {
			this._clear();
		} else {
			last_date = this._getlastdate();
		}

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

		logger && logger.info('start search service');

		if (Chatpal.Backend.enabled) {
			this.indexer = new ChatpalIndexer(Chatpal.Backend.refresh);
		}
	}

	stop() {
		if (Chatpal.Backend.enabled && this.indexer) {
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


	_getRoomData(room_id) {
		const user = Meteor.user();

		const room = RocketChat.models.Rooms.findById(room_id).fetch();
		if (room && room.length > 0) {
			return {
				id: room_id,
				name: room[0].name,
				subscription: this._getSubscription(room_id, user._id),
				announcement: room[0].announcement,
				description: room[0].description,
				topic: room[0].topic
			};
		} else {
			return {
				name: 'Unknown'
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
		return rooms.length > 0 ? `type:CHATPAL_RESULT_TYPE_MESSAGE AND room:(${ rooms.map(room => room.rid).join(' OR ') })` : 'type:CHATPAL_RESULT_TYPE_MESSAGE';
	}

	_getGroupAccessFiler(user) {
		const rooms = RocketChat.models.Subscriptions.find({'u._id': user._id}).fetch();
		return rooms.length > 0 ? `(type:CHATPAL_RESULT_TYPE_USER OR room:(${ rooms.map(room => room.rid).join(' OR ') }))` : '';
	}

	_getQueryParameterStringForMessages(text, page, /*filters*/) {
		const pagesize = Chatpal.Backend.config.docs_per_page;
		return {
			q:text,
			'hl.fl':`text_${ Chatpal.Backend.language }`,
			'fq': this._getAccessFiler(Meteor.user()),
			qf:`text_${ Chatpal.Backend.language }^2 text`,
			start:(page-1)*pagesize,
			rows: pagesize
		};
	}

	_getQueryParameterStringForAll(text, /*filters*/) {
		return {
			q:text,
			'hl.fl':`text_${ Chatpal.Backend.language }`,
			qf:`text_${ Chatpal.Backend.language }^2 text`,
			group:true,
			'group.field':'type',
			sort:'if(termfreq(type,\'CHATPAL_RESULT_TYPE_USER\'),2,if(termfreq(type,\'CHATPAL_RESULT_TYPE_MESSAGE\'),1,0)) desc',
			'group.sort':'score desc',
			'group.limit': Chatpal.Backend.config.docs_per_page,
			fq:this._getGroupAccessFiler(Meteor.user())
		};
	}

	_alignResponse(result) {
		const res = result.response;
		const user = Meteor.user();

		res.docs.forEach((doc) => {
			if (result.highlighting && result.highlighting[doc.id] && result.highlighting[doc.id][`text_${ Chatpal.Backend.language }`]) {
				doc.highlight_text = result.highlighting[doc.id][`text_${ Chatpal.Backend.language }`][0];
			} else {
				doc.highlight_text = doc.text;
			}

			doc.id = doc.id.substring(2);
			doc.user_data = this._getUserData(doc.user);
			doc.date_strings = this._getDateStrings(doc.created);
			doc.subscription = this._getSubscription(doc.room, user._id);

		});

		res.pageSize = Chatpal.Backend.config.docs_per_page;

		return res;
	}

	_alignUserResponse(result) {
		const response = {numFound:result.numFound, docs:[]};

		result.docs.forEach((doc) => {
			response.docs.push(this._getUserData(doc.id.substring(2)));
		});

		return response;
	}

	_alignRoomResponse(result) {
		const response = {numFound:result.numFound, docs:[]};

		result.docs.forEach((doc) => {
			response.docs.push(this._getRoomData(doc.id.substring(2)));
		});

		return response;
	}

	_alignGroupedResponse(result) {
		const response = {};

		result.grouped.type.groups.forEach((group) => {
			if (group.groupValue === 'CHATPAL_RESULT_TYPE_USER') {
				response.users = this._alignUserResponse(group.doclist);
			}
			if (group.groupValue === 'CHATPAL_RESULT_TYPE_ROOM') {
				response.rooms = this._alignRoomResponse(group.doclist);
			}
			if (group.groupValue === 'CHATPAL_RESULT_TYPE_MESSAGE') {
				response.messages = this._alignResponse({
					response:group.doclist,
					highlighting:result.highlighting
				});
			}
		});
		return response;
	}

	_searchAsyncMessages(text, page, filters, callback) {

		const options = {
			params: this._getQueryParameterStringForMessages(text, page, filters)
		};

		_.extend(options, Chatpal.Backend.httpOptions);

		logger && logger.debug('query messages:', options);

		HTTP.call('POST', Chatpal.Backend.baseurl + Chatpal.Backend.searchpath, options, (err, data) => {

			if (err) {
				if (err.response && err.response.statusCode === 400) {
					callback({status:400, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_BAD_QUERY'});
				} else {
					callback({status:err.response ? err.response.statusCode : 0, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_FAILED'});
				}
			} else {
				const result = this._alignResponse(JSON.parse(data.content));

				callback(null, result);
			}

		});
	}

	_searchAsyncAll(text, page, filters, callback) {

		const options = {
			params: this._getQueryParameterStringForAll(text, page, filters)
		};

		_.extend(options, Chatpal.Backend.httpOptions);

		logger && logger.debug('query messages:', options);

		HTTP.call('POST', Chatpal.Backend.baseurl + Chatpal.Backend.searchpath, options, (err, data) => {

			if (err) {
				if (err.response && err.response.statusCode === 400) {
					callback({status:400, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_BAD_QUERY'});
				} else {
					callback({status:err.response ? err.response.statusCode : 0, msg:'CHATPAL_MSG_ERROR_SEARCH_REQUEST_FAILED'});
				}
			} else {
				const result = this._alignGroupedResponse(JSON.parse(data.content));

				callback(null, result);
			}

		});
	}

	index(m) {
		if (Chatpal.Backend.enabled) {

			const options = {data:ChatpalIndexer.getIndexMessageDocument(m)};

			_.extend(options, Chatpal.Backend.httpOptions);

			HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);
		}
	}

	indexUser(u) {
		if (Chatpal.Backend.enabled) {

			const options = {data:ChatpalIndexer.getIndexUserDocument(u)};

			_.extend(options, Chatpal.Backend.httpOptions);

			if (u.active) {
				logger && logger.debug('Index User', u._id);

				HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);
			} else {
				logger && logger.debug('Remove inactive User', `u_${ u._id }`);

				this.remove(`u_${ u._id }`);
			}
		}
	}

	indexRoom(r) {
		if (Chatpal.Backend.enabled) {

			const options = {data:ChatpalIndexer.getIndexRoomDocument(r)};

			_.extend(options, Chatpal.Backend.httpOptions);

			logger && logger.debug('Index Room', r._id);

			HTTP.call('POST', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.updatepath }`, options);
		}
	}

	indexUserById(id) {
		const u = Meteor.users.findOne(id);

		logger && logger.debug('Index User by id', id);

		if (u !== null) { this.indexUser(u); }
	}

	indexRoomById(id) {
		const r = RocketChat.models.Rooms.findOne(id);

		logger && logger.debug('Index Room by id', id);

		if (r !== null) { this.indexRoom(r); }
	}

	reindex() {
		if (Chatpal.Backend.enabled && this.indexer) {

			logger && logger.debug('Reindex');

			this.indexer.reindex();
		}
	}

	getStatistics() {
		if (Chatpal.Backend.enabled) {

			const options = {
				params: {
					q: '*:*',
					rows: 0,
					wt: 'json',
					facet: true,
					'facet.range': 'created',
					'facet.range.start': 'NOW/DAY-1MONTHS',
					'facet.range.end': 'NOW/DAY',
					'facet.range.gap': '+1DAY',
					'facet.field': 'type'
				}
			};

			_.extend(options, Chatpal.Backend.httpOptions);

			try {
				const response = HTTP.call('GET', `${ Chatpal.Backend.baseurl }${ Chatpal.Backend.searchpath }`, options);

				const stats = {
					enabled: true,
					numbers: {
						messages: (response.data.facet_counts.facet_fields.type && response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_MESSAGE) ? response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_MESSAGE : 0,
						users: (response.data.facet_counts.facet_fields.type && response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_USER) ? response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_USER : 0,
						rooms: (response.data.facet_counts.facet_fields.type && response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_ROOM) ? response.data.facet_counts.facet_fields.type.CHATPAL_RESULT_TYPE_ROOM : 0
					},
					chart: [],
					running: this.indexer?this.indexer.running:false
				};

				const chart_result = response.data.facet_counts.facet_ranges.created.counts;

				Object.keys(chart_result).forEach(function(date) {
					stats.chart.push([new Date(date), chart_result[date]]);
				});

				return stats;

			} catch (e) {
				logger && logger.error(e);
				return {enabled:false};
			}
		} else {
			return {enabled:false};
		}
	}

	remove(m) {
		if (Chatpal.Backend.enabled) {
			logger && logger.debug('Remove document', m);

			const options = {data:{
				delete: m,
				commit: {}
			}};

			_.extend(options, Chatpal.Backend.httpOptions);

			HTTP.call('POST', Chatpal.Backend.baseurl + Chatpal.Backend.clearpath, options);
		}
	}

	search(text, page, type = 'All', filters) {
		const fut = new Future();

		const bound_callback = Meteor.bindEnvironment(function(err, res) {
			if (err) {
				fut.throw(err);
			} else {
				fut.return(res);
			}
		});

		if (Chatpal.Backend.enabled) {
			this[`_searchAsync${ type }`](text, page, filters, bound_callback);
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
 * Listen to message changes via Hooks
 * ========
 */
RocketChat.callbacks.add('afterSaveMessage', function(m) {
	Chatpal.service.SearchService.index(m);
});

RocketChat.callbacks.add('afterDeleteMessage', function(m) {
	Chatpal.service.SearchService.remove(`m_${ m._id }`);
});

/**
 * Listen to user changes via cursor
 * =================================
 */
const cursor = Meteor.users.find({}, {fields: {name:1, username:1, emails:1, active:1}});
cursor.observeChanges({
	added: (id) => {
		logger && logger.debug('Added user', id);
		Chatpal.service.SearchService.indexUserById(id);
	},
	changed: (id) => {
		logger && logger.debug('Changed user', id);
		Chatpal.service.SearchService.indexUserById(id);
	},
	removed: (id) => {
		logger && logger.debug('Deleted user', id);
		Chatpal.service.SearchService.remove(`u_${ id }`);
	}
});

const cursor2 = RocketChat.models.Rooms.find({t:{$ne:'d'}}, {fields:{name:1, announcement:1, description:1, topic:1}});
cursor2.observeChanges({
	added: (id) => {
		logger && logger.debug('Added room', id);
		Chatpal.service.SearchService.indexRoomById(id);
	},
	changed: (id) => {
		logger && logger.debug('Changed room', id);
		Chatpal.service.SearchService.indexRoomById(id);
	},
	removed: (id) => {
		logger && logger.debug('Deleted room', id);
		Chatpal.service.SearchService.remove(`r_${ id }`);
	}
});


