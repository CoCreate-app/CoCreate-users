var permissionClass = 'checkPermission';
var usersCollection = 'users';
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
  CoCreateSocket.listen('fetchedUser', function(data) {
    fetchedUser(data);
  })
  
  CoCreateSocket.listen('login', function (data) {
    loginResult(data);
  })
  
  CoCreateSocket.listen('createDocument', function(data) {
    registerResult(data);
  })
  
  CoCreateSocket.listen('usersCurrentOrg', function(data) {
    console.log(data);
    
    updatedCurrentOrg = true;
    
    getOrg = true;
    
    localStorage.setItem('apiKey', data['apiKey']);
    localStorage.setItem('securityKey', data['securityKey']);
    localStorage.setItem('organization_id', data['current_org']);
    
    localStorage.setItem('adminUI_id', data['adminUI_id']);
    localStorage.setItem('builderUI_id', data['builderUI_id']);
    
  })
}

function fetchUser() {
  
  var user_id = localStorage.getItem('user_id');

  if (user_id) {
    var json = {
      "apiKey": config.apiKey,
      "securityKey": config.securityKey,
      "organization_id": config.organization_Id,
      "data-collection": usersCollection,
      "user_id": user_id
    }
    
    CoCreateSocket.send('fetchUser', json);
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
    if (isLoginForm(forms[i])) initLoginForm(forms[i]);  
  }
}

function initLoginForm(form) {
  console.log(form);
  
  var form_id = form.getAttribute('data-form_id');
  
  var loginBtn = form.querySelector('.loginBtn');
  
  loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    console.log(this);
    
    var collection = form.getAttribute('data-search_collection') ? form.getAttribute('data-search_collection') : 'module_activity';
    var search_module = form.getAttribute('data-search_module');
    
    console.log(collection, search_module);
    
    var loginData = new Object();
    
    var inputs = form.querySelectorAll('input, textarea');
    console.log(inputs);
    
    for (var i=0; i<inputs.length; i++) {
      var input = inputs[i];
      var name = input.getAttribute('name');
      var value = input.value;
      
      if (input.type == 'password') value = CoCreateUtils.encodeBase64(value);
      
      if (name) {
        loginData[name] = value;
      }
    }
    
    var json = {
      "apiKey": config.apiKey,
      "securityKey": config.securityKey,
      "organization_id": config.organization_Id,
      "eId": form_id,
      "data-collection": collection,
      "loginData": loginData
    }
    
    if (collection == 'module_activity') json['data-module'] = search_module;
    
    console.log(json);
    
    CoCreateSocket.send('login', json);
  })
}

function loginResult(data) {
  if (data.success) {
    localStorage.setItem('user_id', data['id']);
    
    
    
    // below code for getting keys
    
    getCurrentOrg(data['id']);
    
    var form_id = data['eId'];
    
    var timer = setInterval(function() {
      if (getOrg) {
        var form = document.querySelector("form[data-form_id='" + form_id + "']");
    
        //console.log(form);
        
        if (form) {
          var loginBtn = form.querySelector('.loginBtn');
          if (loginBtn) {
            var aTag = loginBtn.querySelector('a');
            
            if (aTag) {
              CoCreateLogic.setLinkProcess(aTag)
              clearInterval(timer);
            }
          }
        }
      }
    }, 100)
    /// end code for getting keys
    
    
    
    //// login without keys
    // var form_id = data['eId'];
    
    // var form = document.querySelector("form[data-form_id='" + form_id + "']");
    
    // console.log(form);
    
    // if (form) {
    //   var loginBtn = form.querySelector('.loginBtn');
    //   if (loginBtn) {
    //     var aTag = loginBtn.querySelector('a');
        
    //     if (aTag) {
    //       clickATaginButton(aTag);
    //     }
    //   }
    // }
    // end
    
    
  } else {
    console.log("can't login");
  }
}

function getCurrentOrg(user_id) {
  var json = {
    "data-collection": 'users',
    "user_id": user_id
  }
  
  CoCreateSocket.send('usersCurrentOrg', json);
}

function isLoginForm(form) {
  var loginBtn= form.querySelector('.loginBtn');
  
  if (loginBtn) return true;
  
  return false;
}

function registerResult(data) {

  var form_id = data['element'];
  const document_id = data['document_id'];
  
  var form = document.querySelector("form[data-form_id='" + form_id + "']");
  
  if (form && isRegisterForm(form)) {
    localStorage.setItem('user_id', document_id);
    
    var button = form.querySelector('.registerBtn');
    
    if (button) {
      var aTag = button.querySelector('a');
      
      if (aTag) {
        aTag.setAttribute('data-pass_document_id', document_id);
        CoCreateLogic.setLinkProcess(aTag)
      }
    }
  }
}

function isRegisterForm(form) {
  var registerBtn = form.querySelector('.registerBtn');
  
  if (registerBtn) return true;
  
  return false;
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
        console.log(CoCreateSelect.getSelectValue(this));
        
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
    console.log(1)
    var redirectTag = document.querySelector('.sessionTrue');
  
    if (redirectTag) {
      console.log(2);
      let redirectLink = redirectTag.getAttribute('href');
      if (redirectLink) {
        console.log(3);
        document.location.href = redirectLink
      } 
    }
  } else {
    console.log(4);
    var redirectTag = document.querySelector('.sessionFalse');
  
    if (redirectTag) {
      console.log(5);
      let redirectLink = redirectTag.getAttribute('href');
      if (redirectLink) {
        console.log(6);
        localStorage.clear();
        document.location.href = redirectLink 
      }
    }
  }
}


