/*globals CustomEvent, btoa*/
import crud from '@cocreate/crud-client';
import action from '@cocreate/actions';
import render from '@cocreate/render';
import '@cocreate/element-prototype';

const CONST_PERMISSION_CLASS = 'checkPermission';

const CoCreateUser = {
	init: function() {
		// this.updatedCurrentOrg = false;
		this.initSocket();
		this.initChangeOrg();
		this.checkSession();
	},

	initSocket: function() {
		const self = this;
		crud.listen('signUp', function(data) {
			self.setDocumentId('users', data.document[0]._id);
			document.dispatchEvent(new CustomEvent('signUp', {
				detail: data
			}));
		});
		crud.listen('fetchedUser', this.checkPermissions);
		crud.listen('signIn', (instance) => self.signInResponse(instance));
		crud.listen('updateUserStatus', this.updateUserStatus);
	},

	signInRequest: function(btn) {
		let form = btn.closest('form');
		let collection = form.getAttribute('collection');
		let query = [];

		const inputs = form.querySelectorAll('input[name="email"], input[name="password"], input[name="username"]');

		inputs.forEach((input) => {
			const name = input.getAttribute('name');
			let value = input.value;
			if (input.type == 'password') {
				value = btoa(value);
			}
			collection = input.getAttribute('collection') || collection;

			query.push({name, value, operator: '$eq'})
		});

		let request = {
			collection,
			document: {
				lastSignIn: new Date().toISOString(),
				current_org: crud.socket.config.organization_id
			},
			filter: {
				query
			}
		}
		
		const socket = crud.socket.getSockets()
		if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine) {
			crud.updateDocument(request).then((response) => {
				response['success'] = false
				response['status'] = "signIn failed"
				if (response.document)  {
					response['success'] = true
					response['status'] = "success"
					this.signInResponse(response)
				} else {
					this.signInResponse(response)
				}
			})
		} else {
			// ToDo: can be depreciated if we have another means of token generation
			request.broadcastBrowser = false
			crud.socket.send('signIn', request);
		}
	},

	signInResponse: function(data) {
		let { success, status, message, token } = data;

		if (success) {
			window.localStorage.setItem('organization_id', crud.socket.config.organization_id);
			window.localStorage.setItem("apiKey", crud.socket.config.apiKey);
			window.localStorage.setItem("host", crud.socket.config.host);
			window.localStorage.setItem('user_id', data.document[0]['_id']);
			window.localStorage.setItem("token", token);
			document.cookie = `token=${token};path=/`;
			message = "Succesful signIn";
			document.dispatchEvent(new CustomEvent('signIn', {
				detail: {}
			}));
		}
		else
			message = "The email or password you entered is incorrect";

		render.data({
			selector: "[template_id='signIn']",
			data: {
				type: 'signIn',
				status,
				message,
				success
			}
		});
	},

	signOut: (btn) => {
		self = this;
		window.localStorage.removeItem("user_id");
		window.localStorage.removeItem("token");

		let allCookies = document.cookie.split(';');

		for (var i = 0; i < allCookies.length; i++)
			document.cookie = allCookies[i] + "=;expires=" +
			new Date(0).toUTCString();

		// Todo: replace with Custom event system
		document.dispatchEvent(new CustomEvent('signOut'));
	},

	initChangeOrg: () => {
		const user_id = window.localStorage.getItem('user_id');

		if (!user_id) return;

		let orgChangers = document.querySelectorAll('.org-changer');

		for (let i = 0; i < orgChangers.length; i++) {
			let orgChanger = orgChangers[i];

			const collection = orgChanger.getAttribute('collection');
			const id = orgChanger.getAttribute('document_id');

			if (collection == 'users' && id == user_id) {
				orgChanger.addEventListener('selected', function(e) {
					// ToDo: can get selected value from event/element, readDocument not required. 
					crud.readDocument({
						collection: collection || 'users',
						document: {
							_id: user_id
						},
					}).then((data) => {
						window.localStorage.setItem('apiKey', data['apiKey']);
						window.localStorage.setItem('organization_id', data.document[0]['current_org']);
						window.localStorage.setItem('host', crud.socket.config.host);
						
						document.dispatchEvent(new CustomEvent('signIn'));
						window.location.reload();

					})
			
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
					window.localStorage.removeItem("user_id");
					window.localStorage.removeItem("token");
			
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
			el.setAttribute('user-status', data['userStatus']);
		});
	},

	// ToDo: variations exist in a few components 
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

	signUp: function(btn) {
		let form = btn.closest("form");
		if (!form) return;
		let org_id = "";
		let elements = form.querySelectorAll("[collection='users'][name]");
		let orgIdElement = form.querySelector("input[collection='organizations'][name='_id']");

		if (orgIdElement)
			org_id = orgIdElement.value;
		else
			org_id = crud.socket.config.organization_id;

		let data = {document: {}};
		//. get form data
		elements.forEach(el => {
			let name = el.getAttribute('name');
			let value = el.getValue();
			if (!name || !value) return;

			if (el.getAttribute('data-type') == 'array') {
				value = [value];
			}
			data.document[name] = value;
		});
		data['collection'] = 'users'
		data.document['current_org'] = org_id;
		data.document['connected_orgs'] = [org_id];

		const socket = crud.socket.getSockets()
		if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine) {
			// ToDo: can use updateDocument with filter query
			crud.createDocument(data).then((response) => {
				self.setDocumentId('users', response.document_id);
				data.database = org_id
				data.document_id = response.document_id
				data.document['_id'] = response.document_id
				data.organization_id = org_id
				crud.createDocument(request).then((response) => {
					
					document.dispatchEvent(new CustomEvent('signUp', {
						detail: response
					}));
		
				})
			})
		} else {
			// ToDo: creates user in platformdb
			crud.socket.send('signUp', {
				collection: 'users',
				...data,
				orgDB: org_id,
				broadcastBrowser: false
			});
		}
	},
};


action.init({
	name: "signUp",
	endEvent: "signUp",
	callback: (btn, data) => {
		CoCreateUser.signUp(btn);
	},
});

action.init({
	name: "signIn",
	endEvent: "signIn",
	callback: (btn, data) => {
		CoCreateUser.signInRequest(btn, data);
	},
});

action.init({
	name: "signOut",
	endEvent: "signOut",
	callback: (btn, data) => {
		CoCreateUser.signOut(btn, data);
	},
});

CoCreateUser.init();

export default CoCreateUser;
