class CoCreateUser {
    constructor(crud) {
        this.wsManager = crud.wsManager
        this.crud = crud
        this.init()
    }

    init() {
        if (this.wsManager) {
            this.wsManager.on('signUp', (socket, data) => this.signUp(socket, data));
            this.wsManager.on('signIn', (socket, data) => this.signIn(socket, data))
            this.wsManager.on('userStatus', (socket, data) => this.userStatus(socket, data))
        }
    }

    async signUp(socket, data) {
        const self = this;
        try {

            if (data.user) {
                const response = await this.crud.createDocument(data.user)
                this.wsManager.broadcast(socket, 'createDocument', response);
            }

            if (data.userKey) {
                const response = await this.crud.createDocument(data.userKey)
                this.wsManager.broadcast(socket, 'createDocument', response);
            }

            self.wsManager.send(socket, 'signUp', data);

        } catch (error) {
            console.log('createDocument error', error);
        }
    }


    /**
        data = {
            namespace: string,	
            collection:	string,
            data: object,
            eId: string,
            key: string,
            organization_id: string
        }
    **/
    async signIn(socket, data) {
        const self = this;
        try {
            this.crud.readDocument(data).then(async (data) => {
                let response = {
                    success: false,
                    message: "signIn failed",
                    status: "failed",
                    userStatus: 'off',
                    uid: data.uid
                }

                if (data.document[0] && data.document[0]._id && self.wsManager.authenticate) {
                    const user_id = data.document[0].key
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
                        //     Data.document['_id'] = data.document[0]._id
                        //     Data.document['lastsignIn'] = data.document[0].lastsignIn
                        //     Data.document['organization_id'] = process.env.organization_id
                        //     crud.updateDocument(Data)
                        // }
                    }
                }
                self.wsManager.send(socket, 'signIn', response)
                self.wsManager.broadcast(socket, 'updateUserStatus', {
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
    async userStatus(socket, data) {
        const self = this;
        try {
            if (!data.user_id || !data.userStatus)
                return
            data.collection = 'users'
            data['document'] = {
                _id: data.user_id,
                userStatus: data.userStatus
            }

            this.crud.updateDocument(data).then((data) => {
                // self.wsManager.broadcast(socket, 'updateUserStatus', data)
                self.wsManager.broadcast(socket, 'updateUserStatus', {
                    user_id: data.user_id,
                    userStatus: data.userStatus,
                    organization_id: data.organization_id || socket.config.organization_id
                })

            })

        } catch (error) {
            console.log('userStatus error')
        }
    }
}

module.exports = CoCreateUser;