/*globals CustomEvent, btoa*/
import crud from '@cocreate/crud-client';
// import input from '@cocreate/elements';
import action from '@cocreate/actions';
import render from '@cocreate/render';

const CONST_PERMISSION_CLASS = 'checkPermission';

const CoCreateUser = {
	init: function() {
		this.updatedCurrentOrg = false;
		this.initSocket();
		this.initChangeOrg();
		this.checkSession();
		this.createUserSocket();
	},

	createUserSocket: function() {
		var user_id = window.localStorage.getItem('user_id');
		if (user_id) {
			crud.socket.create({
				namespace: 'users',
				room: user_id,
				host: window.config.host
			})
		}
	},

	initSocket: function() {
		const self = this;
		crud.listen('createUser', function(data) {
			self.setDocumentId('users', data.document_id);
			document.dispatchEvent(new CustomEvent('createUser', {
				detail: data
			}));
		});
		crud.listen('fetchedUser', this.checkPermissions);
		crud.listen('login', (instance) => self.loginResponse(instance));
		crud.listen('updateUserStatus', this.updateUserStatus);
		crud.listen('userCurrentOrg', (instance) => self.setCurrentOrg(instance));
	},

	loginRequest: function(btn) {
		let form = btn.closest('form');
		let collection = form.getAttribute('collection');
		let loginData = {};

		// const inputs = form.querySelectorAll('input, textarea');
		const inputs = form.querySelectorAll('input[name="email"], input[name="password"], input[name="username"]');

		inputs.forEach((input) => {
			const name = input.getAttribute('name');
			let value = input.value;
			if (input.type == 'password') {
				value = btoa(value);
			}
			collection = input.getAttribute('collection') || collection;

			if (name) {
				loginData[name] = value;
			}
		});

		crud.send('login', {
			"apiKey": window.config.apiKey,
			"organization_id": window.config.organization_id,
			"collection": collection,
			"loginData": loginData
		});
	},

	loginResponse: function(data) {
		let { success, status, message, token } = data;

		if (success) {
			window.localStorage.setItem('organization_id', window.config.organization_id);
			window.localStorage.setItem("apiKey", window.config.apiKey);
			window.localStorage.setItem("host", window.config.host);
			window.localStorage.setItem('user_id', data['document_id']);
			window.localStorage.setItem("token", token);
			document.cookie = `token=${token};path=/`;
			this.getCurrentOrg(data['document_id'], data['collection']);
			message = "Succesful Login";
			document.dispatchEvent(new CustomEvent('login', {
				detail: {}
			}));
		}
		else
			message = "The email or password you entered is incorrect";

		render.data({
			selector: "[template_id='login']",
			data: {
				type: 'login',
				status,
				message,
				success
			}
		});
	},

	getCurrentOrg: function(user_id, collection) {
		crud.send('userCurrentOrg', {
			"apiKey": window.config.apiKey,
			"organization_id": window.config.organization_id,
			"collection": collection || 'users',
			"user_id": user_id,
		});
	},

	setCurrentOrg: function(data) {
		this.updatedCurrentOrg = true;
		window.localStorage.setItem('apiKey', data['apiKey']);
		window.localStorage.setItem('organization_id', data['current_org']);
		window.localStorage.setItem('host', window.config.host);

		document.dispatchEvent(new CustomEvent('logIn'));
	},

	logout: (btn) => {
		self = this;
		window.localStorage.clear();

		let allCookies = document.cookie.split(';');

		for (var i = 0; i < allCookies.length; i++)
			document.cookie = allCookies[i] + "=;expires=" +
			new Date(0).toUTCString();

		// Todo: replace with Custom event system
		document.dispatchEvent(new CustomEvent('logout'));
	},

	initChangeOrg: () => {
		const user_id = window.localStorage.getItem('user_id');

		if (!user_id) return;

		let orgChangers = document.querySelectorAll('.org-changer');

		for (let i = 0; i < orgChangers.length; i++) {
			let orgChanger = orgChangers[i];

			const collection = orgChanger.getAttribute('collection') ? orgChanger.getAttribute('collection') : 'module_activity';
			const id = orgChanger.getAttribute('document_id');

			if (collection == 'users' && id == user_id) {
				orgChanger.addEventListener('selectedValue', function(e) {

					setTimeout(function() {
						getCurrentOrg(user_id);

						var timer = setInterval(function() {
							if (updatedCurrentOrg) {
								window.location.reload();

								clearInterval(timer);
							}
						}, 100);
					}, 300);
				});
			}
		}
	},

	checkSession: () => {
		let user_id = window.localStorage.getItem('user_id');
		let token = window.localStorage.getItem('token');
		if (user_id && token) {
			let redirectTag = document.querySelector('[session="true"]');

			if (redirectTag) {
				let redirectLink = redirectTag.getAttribute('href');
				if (redirectLink) {
					document.location.href = redirectLink;
				}
			}
		}
		else {
			let redirectTag = document.querySelector('[session="false"]');

			if (redirectTag) {
				let redirectLink = redirectTag.getAttribute('href');
				if (redirectLink) {
					window.localStorage.clear();
					// this.deleteCookie();
					document.location.href = redirectLink;
				}
			}
		}
	},

	checkPermissions: (data) => {
		const tags = document.querySelectorAll('.' + CONST_PERMISSION_CLASS);
		tags.forEach((tag) => {
			let module_id = tag.getAttribute('document_id') ? tag.getAttribute('document_id') : tag.getAttribute('pass-document_id');
			let data_permission = tag.getAttribute('data-permission');
			let userPermission = data['permission-' + module_id];

			if (userPermission.indexOf(data_permission) == -1) {
				switch (data_permission) {
					case 'create':
						tag.style.display = 'none';
						break;
					case 'read':
						tag.style.display = 'none';
						break;
					case 'update':
						tag.style.display = 'none';
						break;
					case 'delete':
						tag.readOnly = true;
						break;
					default:
						// code
				}
			}
			else {
				switch (data_permission) {

					// code
				}
			}
		});
	},

	updateUserStatus: (data) => {
		if (!data.user_id) {
			return;
		}
		let statusEls = document.querySelectorAll(`[user-status][document_id='${data['user_id']}']`);

		statusEls.forEach((el) => {
			el.setAttribute('user-status', data['status']);
		});
	},

	setDocumentId: function(collection, id) {
		let orgIdElements = document.querySelectorAll(`[collection='${collection}']`);
		if (orgIdElements && orgIdElements.length > 0) {
			orgIdElements.forEach((el) => {
				if (!el.getAttribute('document_id')) {
					el.setAttribute('document_id', id);
				}
				if (el.getAttribute('name') == "_id") {
					el.value = id;
				}
			});
		}
	},

	createUser: function(btn) {
		let form = btn.closest("form");
		if (!form) return;
		let org_id = "";
		let elements = form.querySelectorAll("[collection='users'][name]");
		let orgIdElement = form.querySelector("input[collection='organizations'][name='_id']");

		if (orgIdElement)
			org_id = orgIdElement.value;
		else
			org_id = config.organization_id;

		let data = {};
		//. get form data
		elements.forEach(el => {
			let name = el.getAttribute('name');
			let value = el.getValue(el) || el.getAttribute('value');
			if (!name || !value) return;

			if (el.getAttribute('data-type') == 'array') {
				value = [value];
			}
			data[name] = value;
		});
		data['current_org'] = org_id;
		data['connected_orgs'] = [org_id];
		data['organization_id'] = config.organization_id;

		const room = config.organization_id;

		crud.send('createUser', {
			apiKey: config.apiKey,
			organization_id: config.organization_id,
			collection: 'users',
			data: data,
			orgDB: org_id
		}, room);
	},
};


action.init({
	name: "createUser",
	endEvent: "createUser",
	callback: (btn, data) => {
		CoCreateUser.createUser(btn);
	},
});

action.init({
	name: "login",
	endEvent: "login",
	callback: (btn, data) => {
		CoCreateUser.loginRequest(btn, data);
	},
});

action.init({
	name: "logout",
	endEvent: "logout",
	callback: (btn, data) => {
		CoCreateUser.logout(btn, data);
	},
});

CoCreateUser.init();

export default CoCreateUser;