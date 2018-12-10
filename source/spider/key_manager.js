/**
 * @auth yangyufei
 * @date 2018-12-06 14:12:31
 * @desc redis键值管理器
 */
const _         = require('lodash');

const redis     = require('../db_manager/redis').redis;
const SysConf   = require('../config');

class KeyManager {
	constructor() {
		this.namespace = `spider-${SysConf.NAME}:keyManager`;
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

		for (let key of keyList) await redis.del(this.namespace, key);

		await redis.del(this.namespace);
	}
}

module.exports = new KeyManager();