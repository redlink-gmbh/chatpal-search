Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return true;
		}
	});

	RocketChat.TabBar.removeButton('message-search');
});

$('body').on('DOMNodeInserted', function(e) {
	const rc = $(e.target).find('#rocket-chat');
	if (rc[0] && !rc.find('.chatpal-external-search-input')[0]) {

		const container = $('<div>').attr('id', 'chatpal-external-search').appendTo(rc);

		//render input field
		Blaze.renderWithData(Template.ChatpalSearch, {}, container[0]);
	}

	const menu = $(e.target).find('.rc-header__block-action');
	if (menu[0]) {
		$('.chatpal-external-search-input').css({right: menu.width()+20, top: 10});console.log($('#chatpal-search-result-container')[0])
		$('#chatpal-search-result-container').css({top: 57});
	}

}).on('DOMNodeRemoved', function() {
	const menu = $('.rc-header__block-action');
	if (!menu[0]) { //TODO is callen to often!
		$('.chatpal-external-search-input').css({right: 20, top:6});
		$('#chatpal-search-result-container').css({top: 48});
	}
});
