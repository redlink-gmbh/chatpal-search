Template.ChatpalSearch.onCreated(function() {

	this.text = '';

	this.result = new ReactiveVar;

	this.loading = new ReactiveVar(false);

	this.pageSize = RocketChat.settings.get('CHATPAL_PAGESIZE');

	this.page = 1;

	this.enabled = new ReactiveVar(true);

	this.search = () => {

		this.result.set(null);
		this.loading.set(true);

		Meteor.call('chatpal.search', this.text, this.page, this.pageSize, [], (err, res) => {
			$('.flex-tab__content').scrollTop(0);
			this.loading.set(false);
			if (err) {
				console.log(err);
			} else {
				this.result.set(res);
			}
		});
	};

	this.ping = () => {
		Meteor.call('chatpal.ping', (err) => {
			if (err) {
				console.log('ping failed');
				this.enabled.set(false);
			} else {
				console.log('ping successful');
				this.enabled.set(true);
			}
		});
	};

	this.ping();

});

Template.ChatpalSearch.onRendered(function() {
	console.log('rendered');
});

Template.ChatpalSearch.onDestroyed(function() {
	console.log('destroyed');
});

Template.ChatpalSearch.events = {
	'keypress input.chatpal-search-input'(evt, t) {
		if (evt.which === 13) {
			t.text = evt.currentTarget.value;
			t.page = 1;
			t.search();
		}
	},
	'click .chatpal-paging-prev'(env, t) {
		t.page -= 1;
		t.search();
	},
	'click .chatpal-paging-next'(env, t) {
		t.page += 1;
		t.search();
	}
};

Template.ChatpalSearch.helpers({
	resultDocs() {
		const result = Template.instance().result.get();
		if (result) {
			return result.docs;
		}
	},

	resultNumFound() {
		const result = Template.instance().result.get();
		if (result) {
			switch (result.numFound) {
				case 0: return TAPi18n.__('CHATPAL_SEARCH_NO_RESULTS');
				case 1: return TAPi18n.__('CHATPAL_SEARCH_ONE_RESULTS');
				default: return TAPi18n.__('CHATPAL_SEARCH_RESULTS', result.numFound);
			}
		}
	},

	resultPaging() {
		const result = Template.instance().result.get();
		if (result) {
			return {
				currentPage: 1 + result.start/Template.instance().pageSize,
				numOfPages: Math.ceil(result.numFound/Template.instance().pageSize)
			};
		}
	},

	loading() {
		return Template.instance().loading.get();
	},

	enabled() {
		return Template.instance().enabled.get();
	}
});
