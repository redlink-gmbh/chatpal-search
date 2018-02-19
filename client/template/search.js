import toastr from 'toastr';

Template.ChatpalSearch.onCreated(function() {


	this.enabled = new ReactiveVar(true);
	this.chatpalActivated = new ReactiveVar(false);
	this.result = new ReactiveVar;
	this.loading = new ReactiveVar(false);
	this.showResults = new ReactiveVar(false);
	this.badRequest = new ReactiveVar(false);

	this.resultType = new ReactiveVar('All');

	this.autorun(() => {

		Meteor.call('chatpal.config.get', (err, config) => {
			if (!err && config) {
				this.chatpalActivated.set(config.chatpalActivated);
			}
		});

	});
});

Template.ChatpalSearch.onRendered(function() {

	this.page = 1;

	this.text = undefined;

	this.search = (type) => {

		this.result.set(null);
		this.loading.set(true);
		this.badRequest.set(false);

		if (type) { this.resultType.set(type); }

		this.showResults.set(true);

		Meteor.call('chatpal.search.search', this.text, this.page, this.resultType.get(), [], (err, res) => {
			$('.flex-tab__content').scrollTop(0);
			this.loading.set(false);
			if (err) {
				if (err.reason.status === 400) {
					this.badRequest.set(err.reason.msg);
				} else {
					this.enabled.set(false);
				}
			} else {
				this.enabled.set(true);
				this.result.set(res);
			}
		});
	};
});

Template.ChatpalSearch.events = {
	'keydown .chatpal-external-search-input-in'(evt, t) {
		if (evt.which === 13) {
			t.page = 1;
			t.text = evt.currentTarget.value;
			t.search();
		}
	},
	'click .chatpal-search-container-close'(evt, t) {
		t.showResults.set(false);
	},
	'click .chatpal-paging-prev'(env, t) {
		t.page -= 1;
		t.search();
	},
	'click .chatpal-paging-next'(env, t) {
		t.page += 1;
		t.search();
	},
	'click .chatpal-search-typefilter li'(evt, t) {
		t.search(evt.currentTarget.getAttribute('value'));
	},
	'click .chatpal-show-more-messages'(evt, t) {
		t.search('Messages');
	}
};

Template.ChatpalSearch.helpers({
	resultDocs() {
		const result = Template.instance().result.get();
		if (result) {
			return result.docs;
		}
	},

	resultMessageDocs() {
		const result = Template.instance().result.get();
		if (result && result.messages) {
			return result.messages.docs;
		}
	},

	resultRoomDocs() {
		const result = Template.instance().result.get();
		if (result && result.rooms) {
			return result.rooms.docs;
		}
	},

	resultUserDocs() {
		const result = Template.instance().result.get();
		if (result && result.users) {
			return result.users.docs;
		}
	},

	numOfUsersFound() {
		const result = Template.instance().result.get();
		if (result && result.users) {
			return result.users.numFound;
		}
	},

	numOfRoomsFound() {
		const result = Template.instance().result.get();
		if (result && result.rooms) {
			return result.rooms.numFound;
		}
	},

	numOfMessagesFound() {
		const result = Template.instance().result.get();
		if (result && result.messages) {
			return result.messages.numFound;
		}
	},

	numOfMessagesMoreThanPageSize() {
		const result = Template.instance().result.get();
		if (result && result.messages) {
			return result.messages.numFound > parseInt(result.messages.pageSize);
		}
	},

	resultNumFound() {
		const result = Template.instance().result.get();
		if (result) {
			switch (result.numFound) {
				case 0:
					return TAPi18n.__('CHATPAL_SEARCH_NO_RESULTS');
				case 1:
					return TAPi18n.__('CHATPAL_SEARCH_ONE_RESULTS');
				default:
					return TAPi18n.__('CHATPAL_SEARCH_RESULTS', result.numFound);
			}
		}
	},

	resultsFoundForAllSearch() {
		const result = Template.instance().result.get();
		return result && (result.messages || result.users || result.rooms);
	},

	resultPaging() {
		const result = Template.instance().result.get();
		if (result) {
			return {
				currentPage: 1 + result.start / result.pageSize,
				numOfPages: Math.ceil(result.numFound / result.pageSize)
			};
		}
	},

	loading() {
		return Template.instance().loading.get();
	},

	enabled() {
		return Template.instance().enabled.get();
	},

	navSelected(type) {
		return Template.instance().resultType.get() === type ? 'selected' : '';
	},

	resultType() {
		return Template.instance().resultType.get();
	},

	badRequest() {
		return Template.instance().badRequest.get();
	},

	showResults() {
		return Template.instance().showResults.get();
	},

	isActivated() {
		return Template.instance().chatpalActivated.get();
	}
});

Template.ChatpalSearchSingleMessage.helpers({
	roomName(subscription) {
		return subscription.name;
	},

	roomIcon(subscription) {
		return RocketChat.roomTypes.getIcon(subscription.t) || 'at'; //TODO fix
	},

	roomLink(subscription) {
		return RocketChat.roomTypes.getRouteLink(subscription.t, subscription);
	}
});

Template.ChatpalSearchSingleRoom.helpers({
	roomName(subscription) {
		return subscription.name;
	},

	roomIcon(subscription) {
		return RocketChat.roomTypes.getIcon(subscription.t) || 'at'; //TODO fix
	},

	roomLink(subscription) {
		return RocketChat.roomTypes.getRouteLink(subscription.t, subscription);
	},

	showPills() {
		return (this.announcement || this.topic || this.description);
	}
});
