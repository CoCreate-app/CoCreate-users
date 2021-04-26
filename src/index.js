import form from '@cocreate/form'

import crud from '@cocreate/crud-client';
import input from '@cocreate/input'
import action from '@cocreate/action'
import render from '@cocreate/render'

var permissionClass = 'checkPermission';
var usersCollection = 'users';
var orgCollection = "organizations";
var createdUserId = "";
var createdOrgId = "";


var redirectClass = 'redirectLink';

checkSession();
initSocketsForUsers();
fetchUser();
initLoginForms();
initCurrentOrgEles();
initLogoutBtn();
//initRegisterForms();

var getOrg = false;
var updatedCurrentOrg = false;


function initSocketsForUsers() {
  crud.listen('fetchedUser', function(data) {
    fetchedUser(data);
  })
  
  crud.listen('login', function (data) {
    loginResult(data);
  })
  
  crud.listen('createDocument', function(data) {
    registerResult(data);
  })
  
  crud.listen('usersCurrentOrg', function(data) {

    updatedCurrentOrg = true;
    getOrg = true;
    
    localStorage.setItem('apiKey', data['apiKey']);
    localStorage.setItem('organization_id', data['current_org']);
    
    localStorage.setItem('adminUI_id', data['adminUI_id']);
    localStorage.setItem('builderUI_id', data['builderUI_id']);

    //. fire fetchedUsersCurrentOrg
    document.dispatchEvent(new CustomEvent('fetchedUsersCurrentOrg'));

    if (data.href) {
      window.location.href = data.href;
    }
  })
  
  // crud.listenMessage('changedUserStatus', function(data) {
  //   changedUserStatus(data)
  // })
}

function fetchUser() {
  
  var user_id = localStorage.getItem('user_id');

  if (user_id) {
    var json = {
      "apiKey": config.apiKey,
      "organization_id": config.organization_Id,
      "data-collection": usersCollection,
      "user_id": user_id
    }
    
    crud.socket.send('fetchUser', json);
  }
}

function fetchedUser(data) {
  console.log(data);
  
  checkPermissions(data);
}

function checkPermissions(data) {
  var tags = document.querySelectorAll('.' + permissionClass);
  
  console.log(tags);
  
  for (var i=0; i<tags.length; i++) {
    var tag = tags[i];
    
    var module_id = tag.getAttribute('data-document_id') ? tag.getAttribute('data-document_id'): tag.getAttribute('data-pass_document_id');
    var data_permission = tag.getAttribute('data-permission');
    
    var userPermission = data['permission-' + module_id];
    
    console.log(userPermission);
    
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
  }
}

function initLoginForms() {
  var forms = document.querySelectorAll('form');
  
  for (var i=0; i < forms.length; i++) {
    initLoginForm(forms[i]);
  }
}

function initLoginForm(form) {

  var loginBtn = form.querySelector('.loginBtn');
  
  if (!loginBtn) return;
  
  loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    let collection = form.getAttribute('data-collection') || 'module_activity';
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
    
    var json = {
      "apiKey": config.apiKey,
      "organization_id": config.organization_Id,
      "data-collection": collection,
      "loginData": loginData
    }

    crud.socket.send('login', json);
  })
}

function loginResult(data) {
  const {success, status, message, token } = data;
  
  localStorage.setItem("token", token)
  document.cookie=`token=${token}`;

  
  render.data({
    selector: "[data-template_id='afterLoginResponse']", 
    render: data
  })

  if (data.success) {
    localStorage.setItem('user_id', data['id']);
    let href = "";
    let aTag = document.querySelector("form .loginBtn a");
    if (aTag) {
      href = aTag.getAttribute('href');
    }
    getCurrentOrg(data['id'], data['collection'], href);

  } else {
    //. render data
    
  }
}


function getCurrentOrg(user_id, collection, href) {
  var json = {
    "data-collection": collection || usersCollection,
    "user_id": user_id,
    "href": href
  }
  
  crud.socket.send('usersCurrentOrg', json);
}

function userRegisterAction(el) {
  if (!el) return;
  var form = el.closest('form');
  if (!form) return;
  form.request({ form });
}

function registerResult(data) {

  if (data['collection'] === orgCollection) {
    createdOrgId = data['document_id'];
  }
  
  if (data['collection'] === usersCollection) {
    createdUserId = data['document_id'];
  }
  
  if (createdOrgId && createdUserId) {
    crud.updateDocument({
      broadcast: false,
      collection: usersCollection,
      document_id: createdUserId,
      data: {
        current_org: createdOrgId,
        connected_orgs: [createdOrgId]
      }, 
      broadcast: false
    })

    localStorage.setItem('user_id', createdUserId)
    // let aTag = document.querySelector(".registerBtn > a");
    // let href = "";
    // if (aTag) {
    //   href= aTag.getAttribute("href");
    // }
    
    getCurrentOrg(createdUserId, usersCollection, null);
  }
}

function initCurrentOrgEles() {
  var user_id = localStorage.getItem('user_id');
  
  if (!user_id) return;
  
  let orgChangers = document.querySelectorAll('.org-changer');
  
  for (let i=0; i < orgChangers.length; i++) {
    let orgChanger = orgChangers[i];
    
    var collection = orgChanger.getAttribute('data-collection') ? orgChanger.getAttribute('data-collection'): 'module_activity';
    var id = orgChanger.getAttribute('data-document_id');
    
    if (collection == 'users' && id == user_id) {
      orgChanger.addEventListener('selectedValue', function(e) {    

        setTimeout(function() {
          getCurrentOrg(user_id);
          
          var timer = setInterval(function() {
            if (updatedCurrentOrg) {
              location.reload();
              
              clearInterval(timer);
            }
          }, 100)
        }, 300)
      })
    }
  }
}

function initLogoutBtn() {
  let logoutBtns = document.querySelectorAll('.logoutBtn');
  
  for (let i=0; i<logoutBtns.length; i++) {
    let logoutBtn = logoutBtns[i];
    
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      localStorage.clear();
      
      let href = this.getAttribute('href');
      if (href) document.location.href = href;
    })
  }
}

function checkSession() {
  
  var user_id = localStorage.getItem('user_id');
  
  if (user_id) {
    var redirectTag = document.querySelector('.sessionTrue');

    if (redirectTag) {
      let redirectLink = redirectTag.getAttribute('href');
      if (redirectLink) {
        document.location.href = redirectLink
      } 
    }
  } else {
    var redirectTag = document.querySelector('.sessionFalse');
  
    if (redirectTag) {
      let redirectLink = redirectTag.getAttribute('href');
      if (redirectLink) {
        localStorage.clear();
        document.location.href = redirectLink 
      }
    }
  }
}

function changedUserStatus(data) {
  if (!data.user_id) {
    return;
  }
  let statusEls = document.querySelectorAll(`[data-user_status][data-document_id='${data['user_id']}']`)
  
  statusEls.forEach((el) => {
    el.setAttribute('data-user_status', data['status']);
  })
}

export default {initSocketsForUsers, fetchUser, fetchedUser, checkPermissions, initLoginForms, initLoginForm, 
loginResult, getCurrentOrg, userRegisterAction, registerResult, initCurrentOrgEles, 
initLogoutBtn, checkSession, changedUserStatus};