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
            this.crud.send(data).then(async (data) => {
                let response = {
                    method: 'signIn',
                    success: false,
                    message: "signIn failed",
                    status: "failed",
                    userStatus: 'off',
                    uid: data.uid
                }

                if (data.object[0] && data.object[0]._id && self.wsManager.authenticate) {
                    const user_id = data.object[0].key
                    const token = await self.wsManager.authenticate.generateToken({ user_id });

                    if (token && token != 'null') {
                        response = {
                            success: true,
                            message: "signIn successful",
                            status: "success",
                            userStatus: 'on',
                            user_id,
                            token,
                            uid: data.uid
                        };

                        // if (data.organization_id != process.env.organization_id) {
                        //     let Data = { organization_id: process.env.organization_id }
                        //     Data.object['_id'] = data.object[0]._id
                        //     Data.object['lastsignIn'] = data.object[0].lastsignIn
                        //     Data.object['organization_id'] = process.env.organization_id
                        //     crud.send(Data)
                        // }
                    }
                }
                self.wsManager.send(response)
                self.wsManager.send({
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
            if (!data.user_id || !data.userStatus)
                return
            data.array = 'users'
            data['object'] = {
                _id: data.user_id,
                userStatus: data.userStatus
            }

            data.method = 'update.object'
            this.crud.send(data).then((data) => {
                self.wsManager.send({
                    method: 'updateUserStatus',
                    user_id: data.user_id,
                    userStatus: data.userStatus,
                    organization_id: data.organization_id || socket.organization_id
                })

            })

        } catch (error) {
            console.log('userStatus error')
        }
    }
}

module.exports = CoCreateUser;