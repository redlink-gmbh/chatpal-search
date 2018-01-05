import toastr from 'toastr';

Template.ChatpalApiKey.onCreated(function() {

	const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

	this.validateEmail = (email) => {
		return re.test(email.toLowerCase());
	};
});

Template.ChatpalApiKey.events({
	'submit form'(e, t) {
		event.preventDefault();

		const email = e.target.email.value;
		const tac = e.target.readtac.checked;

		if (!tac) { return toastr.error(TAPi18n.__('chatpal-error-tac-must-be-checked')); }
		if (!email || email === '') { return toastr.error(TAPi18n.__('chatpal-error-email-must-be-set')); }
		if (!t.validateEmail(email)) { return toastr.error(TAPi18n.__('chatpal-error-email-must-be-valid')); }

		//TODO register
		const key = '123';
		const type = 'cloud';

		toastr.info(TAPi18n.__('chatpal-info-key-created'));

		FlowRouter.go('/admin/chatpal', {}, {key, type});
	}
});
