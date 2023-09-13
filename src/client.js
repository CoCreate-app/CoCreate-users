/*globals CustomEvent, btoa*/
import Crud from '@cocreate/crud-client';
import Action from '@cocreate/actions';
import Elements from '@cocreate/elements';
import Render from '@cocreate/render';
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
        Crud.listen('updateUserStatus', (data) => self.updateUserStatus(data));
    },

    signUp: async function (btn) {
        let formEl = btn.closest("form");
        if (!formEl) return;

        let organization_id = Crud.socket.config.organization_id;
        let array = formEl.getAttribute('array')
        if (!array) {
            for (let el of formEl) {
                array = el.getAttribute('array');
                if (array)
                    break;
            }
        }

        let data = Elements.getFormData(formEl, array)
        data.method = 'create.object'
        data['array'] = array
        data.organization_id = organization_id;

        if (!data.object[0]._id)
            data.object[0]._id = Crud.ObjectId();

        let user = await Crud.send(data)
        Elements.setTypeValue(formEl, user)

        // const socket = Crud.socket.getSockets()
        // if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine) {
        let key = {
            method: 'create.object',
            array: 'keys',
            object: {
                type: "user",
                key: user.object[0]._id,
                roles: ['user'],
                email: user.object.email,
                password: user.object.password || btoa('0000'),
                array
            },
            organization_id
        }

        let response = await Crud.send(key)
        if (response && response.object && response.object[0]) {
            Crud.socket.send({ method: 'signUp', user, userKey })

            Render.data({
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
        let array = form.getAttribute('array');
        let query = [];

        const inputs = form.querySelectorAll('input[key="email"], input[key="password"], input[key="username"]');

        inputs.forEach((input) => {
            const key = input.getAttribute('key');
            const value = input.getValue();
            array = 'keys';
            query.push({ key, value, operator: '$eq' })
        });

        let request = {
            method: 'read.object',
            db: 'indexeddb',
            array,
            $filter: {
                query
            }
        }

        const socket = Crud.socket.getSockets()
        if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine || Crud.socket.serverOrganization == false) {
            Crud.send(request).then((response) => {
                response['success'] = false
                response['status'] = "signIn failed"
                if (response.object && response.object[0]) {
                    response['success'] = true
                    response['status'] = "success"
                    response['user_id'] = response.object[0].key
                    this.signInResponse(response)
                } else {
                    this.signInResponse(response)
                }
            })
        } else {
            request.method = 'signIn'
            request.broadcastBrowser = false
            delete request.storage
            Crud.socket.send(request).then((response) => {
                this.signInResponse(response)
            })
        }
    },

    signInResponse: function (data) {
        let { success, status, message, user_id, token } = data;

        if (success) {
            localStorage.setItem('organization_id', Crud.socket.config.organization_id);
            localStorage.setItem("key", Crud.socket.config.key);
            localStorage.setItem("host", Crud.socket.config.host);
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

        Render.data({
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

        Render.data({
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
            let statusEls = document.querySelectorAll(`[user-status][object='${data['user_id']}']`);

            statusEls.forEach((el) => {
                el.setAttribute('user-status', data['userStatus']);
            });
        }

    },

    redirect: (data) => {
        if (data.user_id && data.user_id !== Crud.socket.config.user_id)
            return
        if (!data.user_id && data.clientId !== Crud.socket.clientId)
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
            Crud.socket.send({
                method: 'sendMessage',
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


Action.init({
    name: "signUp",
    endEvent: "signUp",
    callback: (data) => {
        CoCreateUser.signUp(data.element);
    },
});

Action.init({
    name: "signIn",
    endEvent: "signIn",
    callback: (data) => {
        CoCreateUser.signIn(data.element);
    },
});

Action.init({
    name: "signOut",
    endEvent: "signOut",
    callback: (data) => {
        CoCreateUser.signOut(data.element);
    },
});

CoCreateUser.init();

export default CoCreateUser;
