Meteor.startup(function() {
	RocketChat.AdminBox.addOption({
		href: 'admin-chatpal',
		i18nLabel: 'CHATPAL_SEARCH',
		icon: 'chatpal',
		permissionGranted() {
			return RocketChat.authz.hasAllPermission('chatpal-admin');
		}
	});

	RocketChat.TabBar.removeButton('message-search');

});

let NEW_HEADER_VERSION = false;

$('body').on('DOMNodeInserted', function(e) {
	const rc = $(e.target).find('#rocket-chat');
	if (rc[0] && !rc.find('.chatpal-external-search-input')[0]) {

		const container = $('<div>').attr('id', 'chatpal-external-search').appendTo(rc);

		//render input field
		Blaze.renderWithData(Template.ChatpalSearch, {}, container[0]);
	}

	if ($(e.target).find('.rc-header')[0]) {
		NEW_HEADER_VERSION = true;
	}

	if (NEW_HEADER_VERSION) {
		const menu = $(e.target).find('.rc-header__block-action');
		if (menu[0]) {
			$('.chatpal-external-search-input').css({right: menu.width()+20, top: 10});
			$('#chatpal-search-result-container').css({top: $('.rc-header').outerHeight(false)});
		}
	} else {
		const fixedTitle = $(e.target).find('.fixed-title');
		if (fixedTitle) {
			$('.chatpal-external-search-input').css({right: 40, top: 11});
			$('#chatpal-search-result-container').css({top: fixedTitle.outerHeight(false)-1});
		}
	}

}).on('DOMNodeRemoved', function() {
	const menu = $('.rc-header__block-action');
	if (!menu[0] && NEW_HEADER_VERSION) { //TODO is callen to often!
		$('.chatpal-external-search-input').css({right: 20, top:6});
		$('#chatpal-search-result-container').css({top: $('.rc-header').outerHeight(false)});
	}
});
