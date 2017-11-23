RocketChat.TabBar.removeButton('message-search');

RocketChat.TabBar.addButton({
	groups: ['live', 'channel', 'privategroup', 'directmessage'],
	id: 'ChatpalSearch',
	i18nTitle: 'CHATPAL_SEARCH',
	icon: 'magnifier',
	template: 'ChatpalSearch',
	order: 0,
	initialOpen: true
});

TAPi18n.loadTranslations({
	en:{
		CHATPAL_ENTER_SEARCH_STRING: 'Enter search string',
		CHATPAL_SEARCH: 'Chatpal Search',
		CHATPAL_BASEURL: 'Search Service URL',
		CHATPAL_PAGESIZE: 'Pagesize',
		CHATPAL_DATE_FORMAT: 'Date format (e.g MMM Do)',
		CHATPAL_TIME_FORMAT: 'Time format (e.g H:mm A)',
		CHATPAL_SEARCH_NO_RESULTS: 'no result',
		CHATPAL_SEARCH_ONE_RESULTS: '1 result',
		CHATPAL_SEARCH_RESULTS: '%s results',
		CHATPAL_SEARCH_PAGE_OF: 'PAGE %s OF %s',
		CHATPAL_SEARCH_GOTO_MESSAGE: 'Go to message'
	},
	de:{
		CHATPAL_ENTER_SEARCH_STRING: 'Suchbegriff eingeben',
		CHATPAL_SEARCH: 'Chatpal Suche',
		CHATPAL_BASEURL: 'URL des Suchservice',
		CHATPAL_PAGESIZE: 'Seitengröße',
		CHATPAL_DATE_FORMAT: 'Datumsformat (e.g MMM Do)',
		CHATPAL_TIME_FORMAT: 'Zeitformat (e.g H:mm A)',
		CHATPAL_SEARCH_NO_RESULTS: 'keine Ergebnisse',
		CHATPAL_SEARCH_ONE_RESULTS: '1 Ergebnis',
		CHATPAL_SEARCH_RESULTS: '%s Ergebnisse',
		CHATPAL_SEARCH_PAGE_OF: 'SEITE %s VON %s',
		CHATPAL_SEARCH_GOTO_MESSAGE: 'Zur Nachricht'
	}
}, 'project');
