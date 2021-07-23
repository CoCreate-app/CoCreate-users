import crud from '@cocreate/crud-client';
import input from '@cocreate/input'
import action from '@cocreate/action'
import render from '@cocreate/render'

const CONST_PERMISSION_CLASS = 'checkPermission' 

const CoCreateUser = {
  // masterDB: '5ae0cfac6fb8c4e656fdaf92', // '5ae0cfac6fb8c4e656fdaf92' /** masterDB **/,
  init: function() {
    this.updatedCurrentOrg = false
    this.initSocket()
    this.initChangeOrg()
    this.checkSession()
  },
  
  initSocket: function() {
    const self = this
		crud.listen('createUser', function(data) {
			self.setDocumentId('users', data.document_id);
			document.dispatchEvent(new CustomEvent('createdUser', {
				detail: data
			}))
		})
    crud.listen('fetchedUser', this.checkPermissions)
    crud.listen('login', (instance)=> self.loginResult(instance))
    crud.listen('changedUserStatus', this.changedUserStatus)
    crud.listen('usersCurrentOrg', (instance)=> self.setCurrentOrg(instance))
  },
  
  requestLogin: function(btn) {
    let form = btn.closest('form')
    let collection = form.getAttribute('data-collection');
    let loginData = {};
    
    const inputs = form.querySelectorAll('input, textarea');

    inputs.forEach((input) => {
      const name = input.getAttribute('name');
      let value = input.value;
      if (input.type == 'password') {
        value = btoa(value);
      }
      collection = input.getAttribute('data-collection') || collection;
      
      if (name) {
        loginData[name] = value;
      }
    })
    
    crud.socket.send('login', {
      "apiKey": window.config.apiKey,
      "organization_id": window.config.organization_Id,
      "data-collection": collection,
      "loginData": loginData
    });
  },
  
  loginResult: function(data) {
    const {success, status, message, token } = data;
    
    if (success) {
      window.localStorage.setItem('user_id', data['id']);
      window.localStorage.setItem("token", token)
      document.cookie=`token=${token};path=/`;
      this.getCurrentOrg(data['id'], data['collection']);
    } 
    render.data({
      selector: "[data-template_id='login']", 
      render: data
    })

  },
  
  getCurrentOrg: function(user_id, collection) {
    crud.socket.send('usersCurrentOrg', {
      "apiKey": window.config.apiKey,
      "organization_id": window.config.organization_Id,
      "data-collection": collection || 'users',
      "user_id": user_id,
    });
  },
  
  setCurrentOrg: function(data) {
    this.updatedCurrentOrg = true;
    window.localStorage.setItem('apiKey', data['apiKey']);
    window.localStorage.setItem('organization_id', data['current_org']);
    window.localStorage.setItem('host', window.config.host);

    window.localStorage.setItem('adminUI_id', data['adminUI_id']);
    window.localStorage.setItem('builderUI_id', data['builderUI_id']);

  	document.dispatchEvent(new CustomEvent('loggedIn'));
  },
  
  logout: (btn) =>  {
    self = this;
    window.localStorage.clear();
    
    let allCookies = document.cookie.split(';');
    
    for (var i = 0; i < allCookies.length; i++)
        document.cookie = allCookies[i] + "=;expires="
        + new Date(0).toUTCString();
        
    // Todo: replace with Custom event system
  	document.dispatchEvent(new CustomEvent('loggedOut'))
  },
 
  initChangeOrg: () => {
    const user_id = window.localStorage.getItem('user_id');
    
    if (!user_id) return;
    
    let orgChangers = document.querySelectorAll('.org-changer');
    
    for (let i=0; i < orgChangers.length; i++) {
      let orgChanger = orgChangers[i];
      
      const collection = orgChanger.getAttribute('data-collection') ? orgChanger.getAttribute('data-collection'): 'module_activity';
      const id = orgChanger.getAttribute('data-document_id');
      
      if (collection == 'users' && id == user_id) {
        orgChanger.addEventListener('selectedValue', function(e) {    
  
          setTimeout(function() {
            getCurrentOrg(user_id);
            
            var timer = setInterval(function() {
              if (updatedCurrentOrg) {
                window.location.reload();
                
                clearInterval(timer);
              }
            }, 100)
          }, 300)
        })
      }
    }
  },
  
  checkSession: () => {
    let user_id = window.localStorage.getItem('user_id');
    if (user_id) {
      let redirectTag = document.querySelector('.sessionTrue');
  
      if (redirectTag) {
        let redirectLink = redirectTag.getAttribute('href');
        if (redirectLink) {
          document.location.href = redirectLink
        } 
      }
    } else {
      let redirectTag = document.querySelector('.sessionFalse');
    
      if (redirectTag) {
        let redirectLink = redirectTag.getAttribute('href');
        if (redirectLink) {
          window.localStorage.clear();
          this.deleteCookie();
          document.location.href = redirectLink 
        }
      }
    }
  },
  
  checkPermissions: (data) => {
    const tags = document.querySelectorAll('.' + CONST_PERMISSION_CLASS);
    tags.forEach((tag) => {
      let module_id = tag.getAttribute('data-document_id') ? tag.getAttribute('data-document_id'): tag.getAttribute('data-pass_document_id');
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
          case 'delete':
            tag.style.display = 'none';
            break;
          case 'delete':
            tag.readOnly = true;
            break;
          default:
            // code
        }
      } else  {
        switch (data_permission) {
          
            // code
        }
      }
    })
  },
  
  changedUserStatus: (data) => {
    if (!data.user_id) {
      return;
    }
    let statusEls = document.querySelectorAll(`[data-user_status][data-document_id='${data['user_id']}']`)
    
    statusEls.forEach((el) => {
      el.setAttribute('data-user_status', data['status']);
    })
  },
  
	setDocumentId: function(collection, id) {
		let orgIdElements = document.querySelectorAll(`[data-collection='${collection}']`);
		if (orgIdElements && orgIdElements.length > 0) {
			orgIdElements.forEach((el) => {
				if (!el.getAttribute('data-document_id')) {
					el.setAttribute('data-document_id', id);
				}
				if (el.getAttribute('name') == "_id") {
					el.value = id;
				}
			})
		}
	},

	createUser: function(btn) {
		let form = btn.closest("form");
		if (!form) return;
		let org_id = "";
		let elements = form.querySelectorAll("[data-collection='users'][name]");
		let orgIdElement = form.querySelector("input[data-collection='organizations'][name='_id']");
		
		if (orgIdElement) {
			org_id = orgIdElement.value;
		}
		let data = {};
		//. get form data
		elements.forEach(el => {
			let name = el.getAttribute('name')
			let value = input.getValue(el) || el.getAttribute('value')
			if (!name || !value) return;
			
			if (el.getAttribute('data-type') == 'array') {
				value = [value];
			}
			data[name] = value;
		})
		data['current_org'] = org_id;
		data['connected_orgs'] = [org_id];
		data['organization_id'] = config.organization_Id;
		
		const room = config.organization_Id;

		crud.socket.send('createUser', {
			apiKey: config.apiKey,
			organization_id: config.organization_Id,
		// 	db: this.masterDB,
			collection: 'users',
			data: data,
			orgDB: org_id
		}, room);
	},
}

CoCreateUser.init();

export default CoCreateUser;

action.init({
	action: "createUser",
	endEvent: "createdUser",
	callback: (btn, data) => {
		CoCreateUser.createUser(btn)
	},
})

action.init({
	action: "login",
	endEvent: "loggedIn",
	callback: (btn, data) => {
		CoCreateUser.requestLogin(btn, data)
	},
})

action.init({
	action: "logout",
	endEvent: "loggedOut",
	callback: (btn, data) => {
		CoCreateUser.logout(btn, data)
	},
})
