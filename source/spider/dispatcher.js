/**
 * @auth yangyufei
 * @date 2018-12-04 19:12:27
 * @desc 任务分发器
 */
const Promise   = require('bluebird');

const SysConf   = require('../config');
const redis     = require('../db_manager/redis').redis;
const logger    = require('../common/logger');
const fetcher   = require('./fetcher');
const checker   = require('./checker');
const keyManager= require('./key_manager');

class Dispatcher {
	constructor(Impl) {
		this.Impl = Impl; // 爬虫实现

		let prefix = `spider-${SysConf.NAME}`;
		this.KEYS = {
			DATA_LIST   : `${prefix}:dispatcher:data`,
			INDEX       : `${prefix}:dispatcher:index`,
			STOP_FLAG   : `${prefix}:stopFlag`,
		};
	}

	async init() {
		// 保存key值
		await keyManager.saveKeyObject(this.KEYS);

		// 生成多个Job任务
		if(await redis.llen(this.KEYS.DATA_LIST) <= 0) {
			let cityList = SysConf.SPIDER.testCity || await fetcher.getCities();

			if (SysConf.SPIDER.testCity) {
				cityList = SysConf.SPIDER.testCity;
			} else {
				// 如果获取不到城市数据，后面所有阶段都无法正常进行
				while(true) {
					if (await redis.exists(this.KEYS.STOP_FLAG)) return;

					try {
						cityList = await fetcher.getCities();
						break;
					} catch (err) {
						logger.error(err);
						logger.warn('dispatcher init阶段无法获取城市列表，5s后重试...');
						await Promise.delay(5000);
					}
				}
			}

			if (await redis.exists(this.KEYS.STOP_FLAG)) return;

			cityList = cityList.map(record => JSON.stringify(record));

			await redis.lpush(this.KEYS.DATA_LIST, cityList);
		}

		// 设置执行Job任务的index
		!await redis.exists(this.KEYS.INDEX) && await redis.set(this.KEYS.INDEX, 0);
	}

	async run() {
		logger.info('=============================================');

		if (await redis.exists(this.KEYS.STOP_FLAG)) {
			logger.warn(`${SysConf.NAME} 爬虫已经停止`);
			return;
		}

		logger.info(`开始抓取${SysConf.NAME}...`);

		await this.init();

		let len = await redis.llen(this.KEYS.DATA_LIST);
		let index = parseInt(await redis.get(this.KEYS.INDEX));

		for (; index < len; index++) {
			// 更新redis中的index的状态
			await redis.set(this.KEYS.INDEX, index);
			let seed = JSON.parse(await redis.lindex(this.KEYS.DATA_LIST, index));

			logger.info(`【总进度 ${index + 1}/${len}】：${((index + 1) / len * 100).toFixed(2)}%==>城市名：${seed.name}，城市代码：${seed.code}`);

			// 抓取一个城市
			let impl = new this.Impl(seed);
			await impl.init();
			await impl.run();
			await impl.clear();
		}

		logger.info(`${SysConf.NAME}抓取结束。`);
	}

	async deleteAll() {
		await keyManager.clearAllKeys();
	}
}

module.exports = Dispatcher;