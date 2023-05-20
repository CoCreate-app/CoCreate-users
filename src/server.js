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
        if (!data.document) return;

        try {
            // Create new user in config db users collection
            this.crud.createDocument(data).then((data) => {
                if (data.document[0] && data.document[0]._id) {
                    // const orgDB = data.orgDB;

                    // if new orgDb Create new user in new org db users collection
                    // if (orgDB && orgDB != data.organization_id) {
                    // 	let Data = {...data, organization_id: orgDB}
                    // 	self.crud.createDocument(Data)
                    // }

                    self.wsManager.broadcast(socket, 'updateDocument', data);
                    self.wsManager.send(socket, 'signUp', data);


                    // add new user to platformDB
                    if (data.organization_id != process.env.organization_id) {
                        let Data = { ...data, organization_id: process.env.organization_id }
                        self.crud.createDocument(Data)
                    }
                }

                // self.wsManager.broadcast(socket, 'updateUserStatus', data)
            })
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
            data.collection = 'keys'
            this.crud.updateDocument(data).then(async (data) => {
                let response = {
                    ...data,
                    success: false,
                    message: "signIn failed",
                    status: "failed",
                    userStatus: 'off'
                }

                if (data.document[0] && data.document[0]._id) {
                    let token = null;
                    if (self.wsManager.authInstance) {
                        token = await self.wsManager.authInstance.generateToken({ user_id: data.document[0]._id });
                    }

                    if (token && token != 'null')
                        response = {
                            ...response,
                            success: true,
                            message: "signIn successful",
                            status: "success",
                            userStatus: 'on',
                            token
                        };


                    if (data.organization_id != process.env.organization_id) {
                        let Data = { organization_id: process.env.organization_id }
                        Data.document['_id'] = data.document[0]._id
                        Data.document['lastsignIn'] = data.document[0].lastsignIn
                        Data.document['organization_id'] = process.env.organization_id
                        crud.updateDocument(Data)
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