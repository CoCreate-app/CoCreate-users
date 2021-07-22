import crud from '@cocreate/crud-client';
import action from '@cocreate/action'
import render from '@cocreate/render'

const CONST_USER_COLLECTION = 'users';
const CONST_PERMISSION_CLASS = 'checkPermission' 
const CONST_ORG_COLLECTION = 'organizations'


const CoCreateUser = {
  
  init: function() {
    this.updatedCurrentOrg = false
    this.created_userId = "";
    this.created_orgId = "";
    
    this.checkSession()
    this.initSocket()
    this.initChangeOrg()
  },
  
  initSocket: function() {
    const self = this
    crud.listen('fetchedUser', this.checkPermissions)
    crud.listen('login', (instance)=> self.loginResult(instance))
    // crud.listen('createDocument', this.registerResult)
    crud.listen('changedUserStatus', this.changedUserStatus)
    crud.listen('usersCurrentOrg', (instance)=> self.setCurrentOrg(instance))
  },
  
  setCurrentOrg: function(data) {
    this.updatedCurrentOrg = true;
    window.localStorage.setItem('apiKey', data['apiKey']);
    window.localStorage.setItem('organization_id', data['current_org']);
    window.localStorage.setItem('host', window.config.host);

    window.localStorage.setItem('adminUI_id', data['adminUI_id']);
    window.localStorage.setItem('builderUI_id', data['builderUI_id']);

  	document.dispatchEvent(new CustomEvent('loggedIn'));
		
    if (data.href) {
      window.location.href = data.href;
    }

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
    
    window.localStorage.setItem("token", token)
    document.cookie=`token=${token};path=/`;

    render.data({
      selector: "[data-template_id='afterLoginResponse']", 
      render: data
    })
  
    if (success) {
      window.localStorage.setItem('user_id', data['id']);
      let href = "";
      let aTag = document.querySelector('form [data-actions*="login"]');
      if (aTag) {
        href = aTag.getAttribute('href');
      }
      this.getCurrentOrg(data['id'], data['collection'], href);
    } else {
      //. render data (failure case)
    }
  },
  
  getCurrentOrg: function(user_id, collection, href) {
    crud.socket.send('usersCurrentOrg', {
      "apiKey": window.config.apiKey,
      "organization_id": window.config.organization_Id,
      "data-collection": collection || CONST_USER_COLLECTION,
      "user_id": user_id,
      "href": href
    });
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
 
  // fetchUser: (data) => {
  //   const user_id = window.localStorage.getItem('user_id');
  //   if (user_id) {
  //     var json = {
  //       "apiKey": window.config.apiKey,
  //       "organization_id": window.config.organization_Id,
  //       "data-collection": CONST_USER_COLLECTION,
  //       "user_id": user_id
  //     }
  //     crud.socket.send('fetchUser', json);
  //   }
  // },
  
  // userRegisterAction : (el) => {
  //   if (!el) return;
  //   var form = el.closest('form');
  //   if (!form) return;
  //   form.request({ form });
  // },
  
  // registerResult: (data) => {
  //   if (data['collection'] === CONST_ORG_COLLECTION) {
  //     this.created_orgId = data['document_id'];
  //   }
    
  //   if (data['collection'] === CONST_USER_COLLECTION) {
  //     this.created_userId = data['document_id'];
  //   }
    
  //   if (this.created_orgId && this.created_userId) {
  //     crud.updateDocument({
  //       broadcast: false,
  //       collection: CONST_USER_COLLECTION,
  //       document_id: this.created_userId,
  //       data: {
  //         current_org: this.created_orgId,
  //         connected_orgs: [this.created_orgId]
  //       }, 
  //       broadcast: false
  //     })
  
  //     window.localStorage.setItem('user_id', this.created_userId)
  //     // let aTag = document.querySelector(".registerBtn > a");
  //     // let href = "";
  //     // if (aTag) {
  //     //   href= aTag.getAttribute("href");
  //     // }
      
  //     this.getCurrentOrg(this.created_userId, CONST_USER_COLLECTION, null);
  //   }
  // },
  
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
  }
}

CoCreateUser.init();

export default CoCreateUser;

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
