/*globals CustomEvent, btoa*/
import Crud from '@cocreate/crud-client';
import Actions from '@cocreate/actions';
import Elements from '@cocreate/elements';
import { render } from '@cocreate/render';
import '@cocreate/element-prototype';
import './index.css';

// TODO: Replace with @cocreate/config
import localStorage from '@cocreate/local-storage';

const CoCreateUser = {
    organization_id: async () => {
        return await Crud.socket.organization_id()
    },

    init: function () {
        this.initSocket();
        this.initSession();
    },

    initSocket: function () {
        const self = this;
        Crud.listen('updateUserStatus', (data) => self.updateUserStatus(data));
    },

    signUp: async function (action) {
        if (!action.form) return;

        let data = await Elements.save(action.form)
        let user = data[0]
        // data.method = 'object.create'
        // data['array'] = array

        // data.organization_id = organization_id;

        // if (!data.object[0]._id)
        //     data.object[0]._id = Crud.ObjectId().toString();

        // let user = await Crud.send(data)
        // Elements.setTypeValue(formEl, user)

        // const socket = Crud.socket.getSockets()
        // if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine) {
        let key = {
            status: 'await',
            method: 'object.create',
            array: 'keys',
            object: {
                _id: user.object[0]._id,
                type: "user",
                key: user.object[0]._id,
                roles: user.object[0].roles,
                email: user.object[0].email,
                password: user.object[0].password || btoa('0000'),
                array: user.array
            }
        }

        let response = await Crud.send(key)
        if (response && response.object && response.object[0]) {
            // Crud.socket.send({ method: 'signUp', user, userKey })

            render({
                selector: "[template*='signUp']",
                data: [{
                    type: 'signUp',
                    message: 'Succesfully Signed Up',
                    success: true
                }]
            });

            document.dispatchEvent(new CustomEvent('signUp', {
                detail: response
            }));

        }
    },

    signIn: async function (action) {
        if (!action.form) return;
        let query = {};

        const inputs = action.form.querySelectorAll('input[key="email"], input[key="password"], input[key="username"]');
        for (let i = 0; i < inputs.length; i++) {
            const key = inputs[i].getAttribute('key');
            const value = await inputs[i].getValue();
            query[key] = value
        }

        let request = {
            method: 'object.read',
            array: 'keys',
            $filter: {
                query
            }
        }

        const socket = await Crud.socket.getSockets()
        if (!socket[0] || !socket[0].connected || window && !window.navigator.onLine || Crud.socket.serverOrganization == false) {
            Crud.send(request).then((response) => {
                response['success'] = false
                response['status'] = "signIn failed"
                if (response.object && response.object[0]) {
                    response['success'] = true
                    response['status'] = "success"
                    response['user_id'] = response.object[0].key
                }
                this.signInResponse(response)
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
        let { success, status, message, organization_id, user_id, token } = data;
        if (success) {
            localStorage.setItem('organization_id', organization_id);
            localStorage.setItem("key", Crud.socket.key);
            localStorage.setItem("host", Crud.socket.host);
            localStorage.setItem('user_id', user_id);
            localStorage.setItem("token", token);
            message = "Successful signIn";
            Crud.socket.user_id = user_id

            document.dispatchEvent(new CustomEvent('signIn', {
                detail: {}
            }));
        }
        else
            message = "The email or password you entered is incorrect";

        render({
            selector: "[template*='signIn']",
            data: [{
                type: 'signIn',
                status,
                message,
                success
            }]
        });
    },

    signOut: () => {
        self = this;
        localStorage.removeItem("user_id");
        localStorage.removeItem("token");

        render({
            selector: "[template*='signOut']",
            data: [{
                type: 'signOut',
                message: 'Succesfully logged out',
                success: true
            }]
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
        if (data.user_id !== Crud.socket.user_id || data.clientId && data.clientId !== Crud.socket.clientId)
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
                    document.location.href = redirectLink;
                }
            }
        }

        if (data.userStatus) {
            let sessionElements = document.querySelectorAll('[session]:not([href])');
            for (let i = 0; i < sessionElements.length; i++)
                sessionElements[i].setAttribute('session', data.userStatus)
        }
    },

    initSession: () => {
        let redirectTag = document.querySelector('[session]');

        if (redirectTag) {
            Crud.socket.send({
                method: 'checkSession',
                broadcast: false,
                broadcastSender: false,
                broadcastBrowser: false
            });
        }

    },

    // TODO: updatePassword()
    forgotPassword: async function (action) {
        let email = action.form.querySelector('input[key="email"]');
        if (!email)
            return
        else
            email = await email.getValue()

        let from = action.form.querySelector('input[key="from"]');
        if (from)
            from = await from.getValue()

        let origin = action.form.querySelector('input[key="origin"]');
        if (origin)
            origin = await origin.getValue() || window.location.origin

        let hostname = action.form.querySelector('input[key="origin"]');
        if (hostname)
            hostname = await hostname.getValue() || window.location.hostname

        let path = action.form.querySelector('input[key="path"]');
        if (path)
            path = await path.getValue()

        let request = {
            method: 'forgotPassword',
            email,
            from,
            domain
        }

        Crud.socket.send(request).then((response) => {
            console.log('forgot password', response)
        })
    },

    resetPassword: async function (action) {
        let data = {
            method: 'resetPassword',
            token
        }
        let email = action.form.querySelector('input[key="email"]');
        if (email)
            data.email = await email.getValue()
        else return

        let password = action.form.querySelector('input[key="password"]');
        if (password)
            data.password = await password.getValue()
        else return

        let token = action.form.querySelector('input[key="token"]');
        if (token)
            data.token = await token.getValue()
        else return

        Crud.socket.send(data).then((data) => {
            console.log('reset password', response)
            if (data.success)
                document.dispatchEvent(new CustomEvent('resetPassword'));
            else
                render({
                    selector: "[template*='resetPassword']",
                    data: [{
                        type: 'resetPassword',
                        message: data.message,
                        success: true
                    }]
                });
        })
    }
};

Actions.init([
    {
        name: "signUp",
        endEvent: "signUp",
        callback: (action) => {
            CoCreateUser.signUp(action);
        }
    },
    {
        name: "signIn",
        endEvent: "signIn",
        callback: (action) => {
            CoCreateUser.signIn(action);
        }
    },
    {
        name: "signOut",
        endEvent: "signOut",
        callback: (action) => {
            CoCreateUser.signOut(action);
        }
    },
    {
        name: "forgotPassword",
        endEvent: "forgotPassword",
        callback: (action) => {
            CoCreateUser.forgotPassword(action);
        }
    },
    {
        name: "resetPassword",
        endEvent: "resetPassword",
        callback: (action) => {
            CoCreateUser.resetPassword(action);
        }
    }
]);

CoCreateUser.init();

export default CoCreateUser;
