/**
 * @auth yangyufei
 * @date 2018-12-04 13:46:41
 * @desc
 */
const Promise       = require('bluebird');

const SysConf       = require('../config');
const {TASK_STATUS} = SysConf;
const redis         = require('../db_manager/redis').redis;
const {Progress}    = require('../common/tools');
const keyManager    = require('./key_manager');
const logger        = require('../common/logger');

class TaskManager {
	constructor(phaseName, no, handler, maxErrCount, concurrency, mode) {
		this.no = no || 1;
		this.phaseName = phaseName;
		this.maxErrCount = maxErrCount || 4;
		this.handler = handler;
		this.concurrency = concurrency || SysConf.SPIDER.task.concurrency;
		this.progress = null;
		this.mode = mode || 'run';

		let prefix = `spider-${SysConf.NAME}:phase${this.no}@${phaseName}`;
		this.KEYS = {
			DATA_LIST   : `${prefix}:data`,
			READY_SET   : `${prefix}:ready`,
			ERROR_SET   : `${prefix}:error`,
			FAILED_SET  : `${prefix}:failed`,
			SUCCESS_SET : `${prefix}:successed`,
			OVER_FLAG   : `${prefix}:over`,
		};

		this.STOP_FLAG = `spider-${SysConf.NAME}:stopFlag`;
	}

	/**
	 * 初始化
	 * @return {Promise.<void>}
	 */
	async init() {
		// 将键存入keyManager中
		await keyManager.saveKey(this.STOP_FLAG);
		await keyManager.saveKeyObject(this.KEYS);

		// 判断任务是否已经执行完毕
		if (await redis.exists(this.KEYS.OVER_FLAG)) {
			return;
		}

		let size = await redis.llen(this.KEYS.DATA_LIST); // 计算任务总数

		let successCount = await redis.scard(this.KEYS.SUCCESS_SET); // 执行成功任务数
		let failCount = await redis.scard(this.KEYS.FAILED_SET); // 执行失败任务数

		// 校验是否有丢失的任务
		if (size > successCount + failCount) {
			for (let index = 0; index < size; index ++) {
				!await redis.sismember(this.KEYS.SUCCESS_SET, index) && !await redis.sismember(this.KEYS.FAILED_SET, index) && await redis.sadd(this.KEYS.READY_SET, index);
			}
		}

		// 如果是fix模式，则将所有失败任务放入到待执行队列中
		if (this.mode === 'fix') {
			await redis.del(this.KEYS.ERROR_SET);

			do {
				let failedIndex = await redis.spop(this.KEYS.FAILED_SET);

				if (failedIndex === null || failedIndex === undefined) break;

				await redis.sadd(this.KEYS.READY_SET, failedIndex);
			} while(true)
		}
	}

	setHandler(handler) {
		this.handler = handler;
	}

	/**
	 * 判断该任务是否已经创建过了
	 * @return {Promise.<boolean>}
	 */
	async isCreated() {
		return await redis.llen(this.KEYS.DATA_LIST);
	}

	/**
	 * 清除中间任务数据并将设置结束标志
	 * @param force
	 * @return {Promise<void>}
	 */
	async clear() {
		for (let key in this.KEYS) await redis.del(this.KEYS[key]);
		await redis.set(this.KEYS.OVER_FLAG, 1);
	}

	/**
	 * 删除任务所有数据
	 * @return {Promise.<void>}
	 */
	async delete() {
		for (let key in this.KEYS) await redis.del(this.KEYS[key]);
	}

	/**
	 * 获取一个任务
	 * @return {Promise<null>}
	 */
	async getOnTask() {
		let taskIndex = await redis.spop(this.KEYS.READY_SET);

		if (taskIndex === null || taskIndex === undefined) {
			return {index: null, task: null};
		} else {
			taskIndex = parseInt(taskIndex);

			let task = await redis.lindex(this.KEYS.DATA_LIST, taskIndex);

			return {index: taskIndex, task: JSON.parse(task)}
		}
	}

	/**
	 * 完成一个任务
	 * @param index
	 * @param success
	 * @return {Promise<void>}
	 */
	async completeOneTask(index, success = true) {
		let key = success ? this.KEYS.SUCCESS_SET : this.KEYS.FAILED_SET;
		await redis.sadd(key, index);

		this.progress.success();
	}

	/**
	 * 插入数据
	 * @param taskList
	 * @return {Promise<Array>}
	 */
	async insertTasks(taskList) {
		if (taskList.length < 1) return;

		let list = taskList.map(task => JSON.stringify(task));
		let startIndex = await redis.llen(this.KEYS.DATA_LIST);

		await redis.lpush(this.KEYS.DATA_LIST, list);

		for (let no = 0; no < taskList.length; no++) {
			await redis.sadd(this.KEYS.READY_SET, startIndex + no);
		}
	}

	/**
	 * 一个任务执行错误
	 * @param index
	 * @return {Promise<void>}
	 */
	async setError(index) {
		let rank = await redis.zrank(this.KEYS.ERROR_SET, index);

		let errCount;
		if (rank === null || rank === undefined) {
			errCount = 1;
			await redis.zadd(this.KEYS.ERROR_SET, 1, index);
		} else {
			await redis.zincrby(this.KEYS.ERROR_SET, 1, index);
			let errCountStr = await redis.zscore(this.KEYS.ERROR_SET, index);

			errCount = parseInt(errCountStr);
		}

		// 如果错误次数过多，则将该任务放入fail队列中，并从err队列中删除
		if (errCount >= this.maxErrCount) {
			await redis.sadd(this.KEYS.FAILED_SET, index);
			await redis.zrem(this.KEYS.ERROR_SET, index);
			this.progress.fail();
		} else {
			await redis.sadd(this.KEYS.READY_SET, index);
		}
	}

	/**
	 * 一个并发运行的任务
	 * @return {Promise<void>}
	 * @private
	 */
	async _microTask() {
		while (true) {
			// 如果停止标志存在，则不再提取任务
			if (await redis.exists(this.STOP_FLAG)) return;

			let {task, index} = await this.getOnTask();

			if (!task) break;

			try {
				await this.handler(task);

				await this.completeOneTask(index);
			} catch (err) {
				await this.setError(index);
			}
		}
	}

	/**
	 * 并发运行任务
	 * @param handler
	 * @param concurrency
	 * @return {Promise<void>}
	 */
	async run() {
		// 如果停止标志存在，则保留当前状态跳过运行阶段
		if (await redis.exists(this.STOP_FLAG)) return;

		if (!await redis.exists(this.KEYS.OVER_FLAG)) {
			logger.info(`${this.no}.开始执行 ${this.phaseName} 阶段...`);

			let total = await redis.llen(this.KEYS.DATA_LIST);
			let successCount = await redis.scard(this.KEYS.SUCCESS_SET);
			let failCount = await redis.scard(this.KEYS.FAILED_SET);

			// 生成进度信息
			this.progress = new Progress(total, successCount, failCount);

			let ps = [];
			for (let i = 0 ; i < SysConf.SPIDER.task.concurrency; i++) {
				ps.push(this._microTask());
			}

			await Promise.all(ps);
		}

		// 停止状态需要保留当前状态，不执行清理工作
		!await redis.exists(this.KEYS.STOP_FLAG) && await this.clear();
	}
}

exports.getOneTaskManager = async (phaseName, handler) => {
	let taskManager = new TaskManager(phaseName, handler);

	await taskManager.init();

	return taskManager;
};