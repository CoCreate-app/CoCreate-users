class CoCreateUser {
    constructor(crud) {
        this.wsManager = crud.wsManager
        this.crud = crud
        this.init()
    }

    init() {
        if (this.wsManager) {
            this.wsManager.on('signUp', (data) => this.signUp(data));
            this.wsManager.on('signIn', (data) => this.signIn(data))
            this.wsManager.on('userStatus', (data) => this.userStatus(data))
            this.wsManager.on('checkSession', (data) => this.checkSession(data))
            this.wsManager.on('inviteUser', (data) => this.inviteUser(data))
            this.wsManager.on('acceptInvite', (data) => this.acceptInvite(data))
            this.wsManager.on('forgotPassword', (data) => this.forgotPassword(data))
            this.wsManager.on('resetPassword', (data) => this.resetPassword(data))
        }
    }

    async signUp(data) {
        try {
            if (data.user) {
                data.user.method = 'object.create'
                data.user.host = data.host
                const response = await this.crud.send(data.user)
                this.wsManager.send(response);
            }

            if (data.userKey) {
                data.userKey.method = 'object.create'
                data.userKey.host = data.host
                const response = await this.crud.send(data.userKey)
                this.wsManager.send(response);
            }

            this.wsManager.send(data);

        } catch (error) {
            console.log('signup error', error);
        }
    }


    /**
        data = {
            namespace: string,	
            array:	string,
            data: object,
            eId: string,
            key: string,
            organization_id: string
        }
    **/
    async signIn(data) {
        const self = this;
        try {
            data.method = 'object.read'
            let socket = data.socket
            delete data.socket

            this.crud.send(data).then(async (data) => {
                let response = {
                    socket,
                    host: data.host,
                    method: 'signIn',
                    success: false,
                    message: "signIn failed",
                    userStatus: 'off',
                    organization_id: data.organization_id,
                    uid: data.uid
                }

                if (data.object[0] && data.object[0]._id && self.wsManager.authenticate) {
                    const user_id = data.object[0].key
                    const token = self.wsManager.authenticate.encodeToken(data.organization_id, user_id, data.clientId);

                    if (token && token != 'null') {
                        socket.user_id = user_id
                        response.success = true
                        response.message = "signIn successful"
                        response.userStatus = 'on'
                        response.user_id = user_id
                        response.token = token
                    }
                }
                self.wsManager.send(response)
                self.wsManager.send({
                    socket,
                    method: 'updateUserStatus',
                    user_id: response.user_id,
                    userStatus: response.userStatus,
                    organization_id: response.organization_id
                })
            })

        } catch (error) {
            console.log('signIn failed', error);
        }
    }


    /**
     * status: 'on/off/idle'
     */
    async userStatus(data) {
        const self = this;
        try {
            if (data.user_id && data.userStatus) {
                data.array = 'users'
                data['object'] = {
                    _id: data.user_id,
                    userStatus: data.userStatus
                }

                data.method = 'object.update'
                data = await this.crud.send(data)

                if (data.socket)
                    self.wsManager.send({
                        socket: data.socket,
                        method: 'updateUserStatus',
                        user_id: data.user_id,
                        clientId: data.clientId,
                        userStatus: data.userStatus,
                        token: data.token,
                        organization_id: data.organization_id || socket.organization_id
                    })
            } else if (data.socket)
                data.socket.send(JSON.stringify({
                    method: 'updateUserStatus',
                    user_id: data.user_id,
                    userStatus: data.userStatus,
                    clientId: data.clientId,
                    token: data.token,
                    organization_id: data.organization_id || socket.organization_id
                }))


        } catch (error) {
            console.log('userStatus error')
        }
    }

    async checkSession(data) {
        try {
            if (!data.socket.user_id) {
                data.method = 'updateUserStatus'
                data.userStatus = 'off'

                this.wsManager.send(data)
            }
        } catch (error) {
            console.log('checkSession error')
        }
    }

    async inviteUser(data) {
        try {
            const inviteId = this.crud.ObjectId().toString()
            let uid = data.uid
            delete data.uid

            data.method = 'object.update'
            data.array = "users"
            data.object = { _id: data.user_id, '$addToSet.invitations': inviteId, '$addToSet.members': data.email }

            data = await this.crud.send(data)

            let invitee = await this.crud.send({
                method: 'object.read',
                host: data.host,
                array: 'users',
                $filter: {
                    query: { email: data.email },
                    limit: 1
                },
                organization_id: data.organization_id
            })

            if (invitee.object[0]) {
                invitee = invitee.object[0]._id
            } else
                invitee = ''

            let htmlBody = `
<html>
<head>
  <title>Welcome to Yellow Oracle!</title>
</head>
<body>
  <p>Hello,</p>

  <p>You have been invited to join ${data.name} on Yellow Oracle.</p>

  <p><a href="${data.origin}${data.path}?email=${data.email}&token=${inviteId}&user_id=${invitee}&name=${data.name}" style="color: #ffffff; background-color: #FFD700; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Your Invitation</a></p>

  <p>Please note, this invitation link will expire in 48 hours. We encourage you to accept it soon to begin your journey with ${data.name} on Yellow Oracle.</p>

  <p>If the button above doesn't work, you can copy and paste the following URL into your web browser:</p>
  <p><a href="${data.origin}${data.path}?email=${data.email}&token=${inviteId}&user_id=${invitee}&name=${data.name}">${data.origin}${data.path}?email=${data.email}&token=${inviteId}&user_id=${invitee}&name=${data.name}</a></p>

  <p>If you received this invitation by mistake or have any questions, please don't hesitate to get in touch with our support team at <a href="mailto:support@${data.hostname}">support@${data.hostname}</a>.</p>

  <p>We look forward to welcoming you to ${data.name}'s Yellow Oracle account!</p>

</body>
</html>                                                                             
`;

            let email = {
                method: 'postmark.sendEmail',
                host: data.host,
                postmark: {
                    "From": data.from,
                    "To": data.email,
                    "Subject": `${data.name} has invited you to join them on Yellow Oracle`,
                    "HtmlBody": htmlBody,
                    "TextBody": "Hello, \n\nWe received a request to reset the password for your account.If you did not make this request, please ignore this email.Otherwise, you can reset your password by copying and pasting the following link into your browser: https://example.com/reset-password\n\nThis link will expire in 24 hours for your security.\n\nNeed more help? Our support team is here for you at support@example.com.\n\nThank you for using our services!\n\nBest regards,\nThe [Your Company] Team",
                    "MessageStream": "outbound"
                },
                organization_id: data.organization_id
            }

            // TODO: wsManager.emit('postmark', email) needs to await response
            this.wsManager.emit('postmark', email);

            let response = {
                socket: data.socket,
                host: data.host,
                method: 'inviteUser',
                success: true,
                message: "Succesfully sent invite",
                organization_id: data.organization_id,
                uid
            }

            this.wsManager.send(response)

        } catch (error) {
            data.error = error
            this.wsManager.send(data)

            console.log('Invite User failed', error);
        }
    }

    async acceptInvite(data) {
        const self = this;
        try {
            if (!data.token || !data.user_id) {
                // TODO: handle error
                return
            }

            let uid = data.uid
            delete data.uid

            data.method = 'object.update'
            data.array = "users"
            data.object = { '$pull.invitations': data.token, '$pull.members': data.email }
            data.$filter = {
                query: {
                    // invitations: { $in: [data.token] },
                    members: { $in: [data.email] },
                    limit: 2
                }
            }

            data = await this.crud.send(data)

            let response = {
                socket: data.socket,
                host: data.host,
                method: 'acceptInvite',
                success: false,
                message: "Token is invalid or has expired",
                organization_id: data.organization_id,
                uid
            }

            for (let object of data.object) {
                if (object._id) {
                    delete data.$filter
                    data.object = { _id: object._id, '$addToSet.members': data.user_id }
                    data = await this.crud.send(data)
                    this.crud.send({ method: 'object.update', host: data.host, array: 'users', object: { _id: data.user_id, memberAccount: object._id, subscription: '6571fe530c48ef6970900a82' } })
                    response.success = true
                    response.message = "Invite Accepted"
                    break
                }
            }

            self.wsManager.send(response)

        } catch (error) {
            console.log("Password reset failed", error);
        }
    }


    async forgotPassword(data) {
        const self = this;
        try {
            const recoveryId = this.crud.ObjectId().toString()
            let socket = data.socket
            delete data.socket

            data.method = 'object.update'
            data.array = "keys"
            data.object = { recoveryId }
            data.$filter = {
                query: { email: data.email },
                limit: 1
            }

            this.crud.send(data).then(async (data) => {
                let response = {
                    socket,
                    host: data.host,
                    method: 'forgotPassword',
                    success: false,
                    message: "Email does not exist",
                    organization_id: data.organization_id,
                    uid: data.uid
                }

                for (let object of data.object) {
                    if (object._id) {
                        // TODO: sendEmail
                        response.success = true
                        response.message = "Email Sent"
                        let htmlBody = `
<html>
<head>
  <title>Reset Your Password</title>
</head>
<body>
  <p>Hello,</p>

  <p>We received a request to reset the password for your account. If you did not make this request, please ignore this email. Otherwise, you can reset your password using the link below.</p>

  <p><a href="${data.origin}${data.path}?email=${data.email}&token=${recoveryId}&recoveyId=${recoveryId}" style="color: #ffffff; background-color: #007bff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset My Password</a></p>

  <p>This link will expire in 24 hours for your security.</p>

  <p>If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
  <p><a href="${data.origin}${data.path}?email=${data.email}&token=${recoveryId}&recoveyId=${recoveryId}"">${data.origin}${data.path}?email=${data.email}&token=${recoveryId}&recoveyId=${recoveryId}"</a></p>

  <p>Need more help? Our support team is here for you. Contact us at <a href="mailto:support@${data.hostname}">support@${data.hostname}</a>.</p>

  <p>Thank you for using our services!</p>

</body>
</html>
`
                        let email = {
                            method: 'postmark.sendEmail',
                            host: data.host,
                            postmark: {
                                "From": data.from,
                                "To": data.email,
                                "Subject": "Reset Your Password Easily",
                                "HtmlBody": htmlBody,
                                "TextBody": "Hello, \n\nWe received a request to reset the password for your account.If you did not make this request, please ignore this email.Otherwise, you can reset your password by copying and pasting the following link into your browser: https://example.com/reset-password\n\nThis link will expire in 24 hours for your security.\n\nNeed more help? Our support team is here for you at support@example.com.\n\nThank you for using our services!\n\nBest regards,\nThe [Your Company] Team",
                                "MessageStream": "outbound"
                            },
                            organization_id: data.organization_id
                        }

                        // TODO: wsManager.emit('postmark', email) needs to await response
                        self.wsManager.emit('postmark', email);

                        break
                    }
                }

                self.wsManager.send(response)
            })

        } catch (error) {
            console.log('Forgot Password failed', error);
        }
    }

    async resetPassword(data) {
        const self = this;
        try {
            if (!data.email || !data.password || !data.token)
                return

            data.method = 'object.update'
            data.array = "keys"
            data.object = { password: data.password, recoveryId: "" }
            data.$filter = {
                query: { email: data.email, recoveryId: data.token },
                limit: 1
            }

            this.crud.send(data).then(async (data) => {
                let response = {
                    socket: data.socket,
                    host: data.host,
                    method: 'resetPassword',
                    success: false,
                    message: "Token is invalid or has expired",
                    organization_id: data.organization_id,
                    uid: data.uid
                }

                for (let object of data.object) {
                    if (object._id) {
                        response.success = true
                        response.message = "Password reset succesfull"
                        break
                    }
                }

                self.wsManager.send(response)
            })
        } catch (error) {
            console.log("Password reset failed", error);
        }
    }
}

module.exports = CoCreateUser;