/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc redis键值管理器
 */
const _         = require('lodash');

const redis     = require('../db_manager/redis').redis;
const SysConf   = require('../config');
const utils     = require('./utils');

class KeyManager {
	constructor() {
		this.namespace = `${utils.makeNameSpace()}:keyManager`;
	}

	/**
	 * 存入一个key
	 * @param key
	 * @return {Promise.<void>}
	 */
	async saveKey(key) {
		await redis.sadd(this.namespace, key);
	}

	/**
	 * 存入key对象
	 * @param keyObject
	 * @return {Promise.<void>}
	 */
	async saveKeyObject(keyObject) {
		for (let key in keyObject) await redis.sadd(this.namespace, keyObject[key]);
	}

	async clearAllKeys() {
		let keyList = await redis.smembers(this.namespace);

		for (let key of keyList) await redis.del(key);

		await redis.del(this.namespace);
	}
}

module.exports = new KeyManager();