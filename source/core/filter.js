/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc
 */
const redis     = require('../db_manager/redis').redis;
const utils     = require('./utils');
const SysConf   = require('../config');

class AbstractFilter {
	constructor(filterKeyName) {
		if (!new.target) {
			throw new Error(`不允许实例化抽象类：AbstractFilter！`);
		}

		this.filterKeyName = `${utils.makeNameSpace()}:filter-${filterKeyName}`;
	}

	/**
	 * 判断一个键是否存在
	 * @param key
	 * @param save
	 * @returns {Promise<void>}
	 */
	async exists(key, save) {
	}

	/**
	 * 清空过滤器
	 * @returns {Promise<void>}
	 */
	async clear() {
		await redis.del(this.filterKeyName);
	}

	/**
	 * 获取当前过滤器大小
	 * @returns {Promise<*>}
	 */
	async size() {
		return await redis.scard(this.filterKeyName);
	}
}

/**
 * 简单过滤器
 */
class SimpleFilter extends AbstractFilter{
	constructor(filterName) {
		super(filterName);
	}

	async exists(key, save = true) {
		typeof key === 'object' && (key = JSON.stringify(key));
		key = key + '';

		let exists = await redis.sismember(this.filterKeyName, key);

		!exists && save && await redis.sadd(this.filterKeyName, key);

		return Boolean(exists);
	}
}

class ExpireFilter extends AbstractFilter {
	// 默认存在3个月
	constructor(filterName, updateTime = 3 * 30 * 24 * 60 * 60 * 1000) {
		super(filterName);

		this.updateTime = updateTime;
	}

	async exists(key, save = true) {
		typeof key === 'object' && (key = JSON.stringify(key));
		key = key + '';


		let exists = true;
		if (await redis.zrank(this.filterKeyName, key) === null) {
			save && await redis.zadd(this.filterKeyName, new Date().getTime(), key);
			exists = false;
		} else {
			let time = await redis.zscore(this.filterKeyName, key);

			let now = new Date().getTime();
			if (now - time > this.updateTime) {
				await redis.zadd(this.filterKeyName, key, now);
				exists = false;
			}
		}

		return exists;
	}
}

/**
 * 生成所有filter
 * @param type
 * @return {Promise.<{}>}
 */
exports.get = async () => {
	let filterManager = {};

	// 根据配置生成filter
	for(let filterKey in SysConf.FILTER) {
		let filterConf = SysConf.FILTER[filterKey];
		let filter;

		switch(filterConf.type) {
			case SysConf.FILTER_TYPE.SIMPLE: filter = new SimpleFilter(filterConf.name); break;
			case SysConf.FILTER_TYPE.EXPIRE: filter = new ExpireFilter(filterConf.name); break;
			default: logger.warn(`错误的filter type：${filterConf.type}`);
		}

		filter && (filterManager[filterKey] = filter);
	}

	// 清理过滤器数据
	filterManager.clear = async function () {
		for (let filterName in this) {
			let property = this[filterName];
			typeof property === 'object' && await this[filterName].clear();
		}
	};

	return filterManager;
};