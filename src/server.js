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
        }
    }

    async signUp(data) {
        const self = this;
        try {

            if (data.user) {
                data.user.method = 'create.object'
                const response = await this.crud.send(data.user)
                this.wsManager.send(response);
            }

            if (data.userKey) {
                data.userKey.method = 'create.object'
                const response = await this.crud.send(data.userKey)
                this.wsManager.send(response);
            }

            self.wsManager.send(data);

        } catch (error) {
            console.log('create.object error', error);
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
            data.method = 'read.object'
            let socket = data.socket
            delete data.socket
            this.crud.send(data).then(async (data) => {
                let response = {
                    socket,
                    method: 'signIn',
                    success: false,
                    message: "signIn failed",
                    userStatus: 'off',
                    organization_id: data.organization_id,
                    uid: data.uid
                }

                if (data.object[0] && data.object[0]._id && self.wsManager.authenticate) {
                    const user_id = data.object[0].key
                    const token = await self.wsManager.authenticate.encodeToken({ user_id });

                    if (token && token != 'null') {
                        socket.user_id = user_id
                        response.success = true
                        response.message = "signIn successful"
                        response.userStatus = 'on'
                        response.user_id = user_id
                        response.token = token
                        response.userStatus = 'on'
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

                data.method = 'update.object'
                data = await this.crud.send(data)

                self.wsManager.send({
                    socket: data.socket,
                    method: 'updateUserStatus',
                    user_id: data.user_id,
                    userStatus: data.userStatus,
                    token: data.token,
                    organization_id: data.organization_id || socket.organization_id
                })
            } else if (data.socket)
                data.socket.send(JSON.stringify({
                    method: 'updateUserStatus',
                    user_id: data.user_id,
                    userStatus: data.userStatus,
                    token: data.token,
                    organization_id: data.organization_id || socket.organization_id
                }))


        } catch (error) {
            console.log('userStatus error')
        }
    }
}

module.exports = CoCreateUser;