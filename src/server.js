const {ObjectId} = require("mongodb");

class CoCreateUser {
	constructor(wsManager, dbClient) {
		this.wsManager = wsManager
		this.dbClient = dbClient
		this.init()
	}
	
	init() {
		if (this.wsManager) {
			this.wsManager.on('createUser',				(socket, data, socketInfo) => this.createUser(socket, data, socketInfo));
			this.wsManager.on('login',					(socket, data, socketInfo) => this.login(socket, data, socketInfo))
			this.wsManager.on('userCurrentOrg',		(socket, data, socketInfo) => this.userCurrentOrg(socket, data, socketInfo))
			this.wsManager.on('userStatus',				(socket, data, socketInfo) => this.userStatus(socket, data, socketInfo))
		}
	}

	async createUser(socket, data, socketInfo) {
		const self = this;
		if(!data.data) return;
		
		try{
			const collection = this.dbClient.db(data['organization_id']).collection(data['collection']);
			// Create new user in config db users collection
			collection.insertOne(data.data, function(error, result) {
				if(!error && result){
					const orgDB = data.orgDB;
					data.data['_id'] = result.insertedId;
					// if new orgDb Create new user in new org db users collection
					if (orgDB && orgDB != data.organization_id) {
						const anotherCollection = self.dbClient.db(orgDB).collection(data['collection']);
						anotherCollection.insertOne({...data.data, organization_id : orgDB});
					}
					const response  = { ...data, document_id: `${result.insertedId}`}
					self.wsManager.send(socket, 'createUser', response, socketInfo);

					// add new user to platformDB
					if (data.organization_id != process.env.organization_id) {	
						const platformDB = self.dbClient.db(process.env.organization_id).collection(data['collection']);
						platformDB.insertOne({...data.data, organization_id: process.env.organization_id});
					}	
				}
			});
		}catch(error){
			console.log('createDocument error', error);
		}
	}


	/**
		data = {
			namespace:				string,	
			collection:	string,
			loginData:				object,
			eId:							string,

			apiKey: string,
			organization_id: string
		}
	**/	
	async login(socket, data, socketInfo) {
		const self = this;
		try {
			const {organization_id} = data
			const selectedDB = organization_id;
			const collection = self.dbClient.db(selectedDB).collection(data["collection"]);
			const query = new Object();
			
			for (let item of data['loginData']) {
				query[item.name] = item.value;
			}
			
			collection.findOneAndUpdate(query, {$set: {lastLogin: new Date()}}, async function(error, result) {
				let response = {
					success: false,
					message: "Login failed",
					status: "failed",
					uid: data['uid']
				}
				if (!error && result && result.value) {
					let token = null;
					if (self.wsManager.authInstance) {
						token = await self.wsManager.authInstance.generateToken({user_id: `${result.value['_id']}`});
					}
					
					if (token && token != 'null')
						response = { ...response,  
							success: true,
							collection: data["collection"],
							document_id: result.value['_id'],
							current_org: result.value['current_org'],
							message: "Login successful",
							status: "success",
							token
						};

					let user_id = response.document_id;
					const query = {
						"_id": new ObjectId(user_id),
					}

					if (data.organization_id != process.env.organization_id) {	
						const platformDB = self.dbClient.db(process.env.organization_id).collection(data['collection']);
						platformDB.updateOne(query, {$set: {lastLogin: new Date()}})
					}	
				} 
				self.wsManager.send(socket, 'login', response, socketInfo)
				console.log(`${response.message} user_id: ${result.value['_id']}`)
			});
		} catch (error) {
			console.log('login failed', error);
		}
	}
	
	/**
		data = {
			namespace:				string,	
			collection:	string,
			user_id:					string,
			href: string
		}
	**/		
	async userCurrentOrg(socket, data, socketInfo) {
		try {
			const self = this;
			const {organization_id, db} = data
			const selectedDB = db || organization_id;
			const collection = this.dbClient.db(selectedDB).collection(data["collection"]);
			
			let query = new Object();
			
			query['_id'] = new ObjectId(data['user_id']);

			collection.find(query).toArray(function(error, result) {
			
				if (!error && result && result.length > 0) {
					
					if (result.length > 0) {
						let org_id = result[0]['current_org'];
						const orgCollection = self.dbClient.db(selectedDB).collection('organizations');
						
						orgCollection.find({"_id": new ObjectId(org_id),}).toArray(function(err, res) {
							if (!err && res && res.length > 0) {
								self.wsManager.send(socket, 'userCurrentOrg', {
									success:			true,
									user_id:			result[0]['_id'],
									current_org:		result[0]['current_org'],
									apiKey: 			res[0]['apiKey'],
									href: 				data['href'],
									uid:				data['uid']
								}, socketInfo)
							}
						});

					}
				} else {
					// socket.emit('loginResult', {
					//   success: false
					// });
				}
			});
		} catch (error) {
			
		}
	}

	
	/**
	 * status: 'on/off/idle'
	 */
	async userStatus(socket, data, socketInfo) {
		const self = this;
		const {info, status} = data;

		const items = info.split('/');

		if (items[0] !== 'users') {
			return;
		}
		
		if (!items[1]) return;

		try {
			const {organization_id, db} = data
			const selectedDB = db || organization_id;
			const collection = self.dbClient.db(selectedDB).collection('users');
			const user_id = items[1];
			const query = {
				"_id": new ObjectId(user_id),
			}
			collection.updateOne(query, {$set: {status: status}}, function(err, res) {
				if (!err) {
					self.wsManager.broadcast(socket, '', null, 'updateUserStatus', 
					{
						user_id,
						status
					}, socketInfo)
				}
				else
					console.log('err', err)
			})
		} catch (error) {
			console.log('userStatus error')
		}
	}
}

module.exports = CoCreateUser;