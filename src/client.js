/*globals CustomEvent, btoa*/
import crud from '@cocreate/crud-client';
import action from '@cocreate/actions';
import form from '@cocreate/form';
import render from '@cocreate/render';
import '@cocreate/element-prototype';
import './index.css';
import localStorage from '@cocreate/local-storage';

const CoCreateUser = {
    init: function () {
        this.initSocket();
        this.initSession();
    },

    initSocket: function () {
        const self = this;
        crud.listen('updateUserStatus', (data) => self.updateUserStatus(data));
    },

    signUp: async function (btn) {
        let formEl = btn.closest("form");
        if (!formEl) return;

        let organization_id = crud.socket.config.organization_id;
        let collection = form.getAttribute('collection')
        if (!collection) {
            for (let el of formEl) {
                collection = el.getAttribute('collection');
                if (collection)
                    break;
            }
        }

        let data = form.getData(formEl, collection)
        data['collection'] = collection
        data.organization_id = organization_id;

        if (!data.document[0]._id)
            data.document[0]._id = crud.ObjectId();

        let user = await crud.createDocument(data)
        form.setDocumentId(formEl, user)

        // const socket = crud.socket.getSockets()
        // if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine) {
        let key = {
            collection: 'keys',
            document: {
                type: "user",
                key: user.document[0]._id,
                roles: ['user'],
                email: user.document.email,
                password: user.document.password || btoa('0000'),
                collection
            },
            organization_id
        }

        let response = await crud.createDocument(key)
        if (response && response.document && response.document[0]) {
            crud.socket.send('signUp', { user, userKey })

            render.data({
                selector: "[template='signUp']",
                data: {
                    type: 'signUp',
                    message: 'Succesfully Signed Up',
                    success: true
                }
            });

            document.dispatchEvent(new CustomEvent('signUp', {
                detail: response
            }));

        }
    },

    signIn: function (btn) {
        let form = btn.closest('form');
        let collection = form.getAttribute('collection');
        let query = [];

        const inputs = form.querySelectorAll('input[name="email"], input[name="password"], input[name="username"]');

        inputs.forEach((input) => {
            const name = input.getAttribute('name');
            const value = input.getValue();
            collection = 'keys';
            query.push({ name, value, operator: '$eq' })
        });

        let request = {
            db: 'indexeddb',
            collection,
            filter: {
                query
            }
        }

        const socket = crud.socket.getSockets()
        if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine || crud.socket.serverOrganization == false) {
            crud.readDocument(request).then((response) => {
                response['success'] = false
                response['status'] = "signIn failed"
                if (response.document && response.document[0]) {
                    response['success'] = true
                    response['status'] = "success"
                    response['user_id'] = response.document[0].key
                    this.signInResponse(response)
                } else {
                    this.signInResponse(response)
                }
            })
        } else {
            request.broadcastBrowser = false
            delete request.db
            crud.socket.send('signIn', request).then((response) => {
                this.signInResponse(response)
            })
        }
    },

    signInResponse: function (data) {
        let { success, status, message, user_id, token } = data;

        if (success) {
            localStorage.setItem('organization_id', crud.socket.config.organization_id);
            localStorage.setItem("key", crud.socket.config.key);
            localStorage.setItem("host", crud.socket.config.host);
            localStorage.setItem('user_id', user_id);
            localStorage.setItem("token", token);
            // document.cookie = `token=${token};path=/`;
            message = "Succesful signIn";
            document.dispatchEvent(new CustomEvent('signIn', {
                detail: {}
            }));
        }
        else
            message = "The email or password you entered is incorrect";

        render.data({
            selector: "[template='signIn']",
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
        localStorage.removeItem("user_id");
        localStorage.removeItem("token");

        // let allCookies = document.cookie.split(';');

        // for (var i = 0; i < allCookies.length; i++)
        // 	document.cookie = allCookies[i] + "=;expires=" +
        // 	new Date(0).toUTCString();

        render.data({
            selector: "[template='signOut']",
            data: {
                type: 'signOut',
                message: 'Succesfully logged out',
                success: true
            }
        });

        // TODO: replace with Custom event system
        document.dispatchEvent(new CustomEvent('signOut'));
    },

    updateUserStatus: function (data) {
        this.redirect(data)
        if (data.user_id) {
            let statusEls = document.querySelectorAll(`[user-status][document_id='${data['user_id']}']`);

            statusEls.forEach((el) => {
                el.setAttribute('user-status', data['userStatus']);
            });
        }

    },

    redirect: (data) => {
        if (data.user_id && data.user_id !== crud.socket.config.user_id)
            return
        if (!data.user_id && data.clientId !== crud.socket.clientId)
            return
        if (data.userStatus == 'on' || data.userStatus == 'idle') {
            let redirectTag = document.querySelector('[session="true"]');

            if (redirectTag) {
                let redirectLink = redirectTag.getAttribute('href');
                if (redirectLink) {
                    document.location.href = redirectLink;
                }
            }
        } else if (data.userStatus == 'off') {
            let redirectTag = document.querySelector('[session="false"]');

            if (redirectTag) {
                let redirectLink = redirectTag.getAttribute('href');
                if (redirectLink) {
                    localStorage.removeItem("user_id");
                    localStorage.removeItem("token");

                    // this.deleteCookie();
                    document.location.href = redirectLink;
                }
            }
        }

    },

    initSession: () => {
        let redirectTag = document.querySelector('[session]');

        if (redirectTag) {
            crud.socket.send('sendMessage', {
                message: 'checkSession',
                broadcast: false,
                broadcastSender: false,
                broadcastBrowser: false
            });
        }

    },

    // TODO: updatePassword()
    updatePassword: function (btn) {
        this.signIn(btn);
    }
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
        CoCreateUser.signIn(btn, data);
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
