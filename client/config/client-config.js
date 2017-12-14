RocketChat.TabBar.removeButton('message-search');

TAPi18n.loadTranslations({
	en: {
		CHATPAL_ENTER_SEARCH_STRING: 'Enter search string',
		CHATPAL_SEARCH: 'Chatpal Search',
		CHATPAL_BOT: 'Chatpal Bots',
		CHATPAL_SEARCH_RESULTS_TITLE: 'Search Results',
		CHATPAL_BASEURL: 'Search Service URL',
		CHATPAL_AUTH_TOKEN: 'Auth-Token',
		CHATPAL_BASIC_AUTH: 'Basic Auth',
		CHATPAL_BOT_BASEURL: 'Bot Service URL',
		CHATPAL_PAGESIZE: 'Pagesize',
		CHATPAL_DATE_FORMAT: 'Date format (e.g MMM Do)',
		CHATPAL_TIME_FORMAT: 'Time format (e.g H:mm A)',
		CHATPAL_SEARCH_NO_RESULTS: 'no result',
		CHATPAL_SEARCH_ONE_RESULTS: '1 result',
		CHATPAL_SEARCH_RESULTS: '%s results',
		CHATPAL_SEARCH_PAGE_OF: 'PAGE %s OF %s',
		CHATPAL_SEARCH_GOTO_MESSAGE: 'Go to message'
	},
	de: {
		CHATPAL_ENTER_SEARCH_STRING: 'Suchbegriff eingeben',
		CHATPAL_SEARCH: 'Chatpal Suche',
		CHATPAL_BOT: 'Chatpal Bots',
		CHATPAL_SEARCH_RESULTS_TITLE: 'Suchergebnisse',
		CHATPAL_BASEURL: 'URL des Suchservice',
		CHATPAL_AUTH_TOKEN: 'Auth-Token',
    CHATPAL_BASIC_AUTH: 'Basic Auth',
		CHATPAL_BOT_BASEURL: 'URL des Botservice',
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

$('body').on('DOMNodeInserted', function(e) {
	const rc = $(e.target).find('#rocket-chat');
	if (rc[0] && !rc.find('.chatpal-external-search-input')[0]) {

		const container = $('<div>').attr('id', 'chatpal-external-search').appendTo(rc);

		//render input field
		Blaze.renderWithData(Template.ChatpalSearch, {}, container[0]);
	}

});
