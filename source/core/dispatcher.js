/**
 * @author  yangyufei
 * @date    2019-01-05 09:32:51
 * @desc
 */
const cluster   = require('cluster');
const Promise   = require('bluebird');

const utils     = require('./utils');
const impl      = require('../spider/impl');
const redis     = require('../db_manager/redis').redis;
const keyManager= require('./key_manager');
const logger    = require('../common/logger');
const SysConf   = require('../config');

const defaultMakeMacroTasks = async () => [{msg: 'This is a placeholder.'}];

const prefix = utils.makeNameSpace();
const KEYS = {
    DATA_LIST   : `${prefix}:dispatcher:data`, // list类型；task数据
    INDEX       : `${prefix}:dispatcher:index`, // set类型；task data中item对应的索引
    OVER_NUM    : `${prefix}:dispatcher:overNum`, // string类型；已经完成的任务数量
};

/**
 * 初始化dispatcher中的数据
 * @returns {Promise<void>}
 */
exports.init = async () => {
    // 默认生成macro任务
    if (!impl.makeMacroTasks || typeof impl.makeMacroTasks !== 'function') {
        impl.makeMacroTasks = defaultMakeMacroTasks;
    }

    // 保存key值
    await keyManager.saveKeyObject(KEYS);

    let taskList;

    if(await redis.llen(KEYS.DATA_LIST) <= 0) {
        // 如果获取不到城市数据，后面所有阶段都无法正常进行
        while(true) {
            try {
                taskList = await impl.makeMacroTasks(this.context);
                break;
            } catch (err) {
                logger.error(err);
                logger.warn('dispatcher init阶段无法获取macroTasks，5s后重试...');
                await Promise.delay(5000);
            }
        }

        taskList = taskList.map(record => JSON.stringify(record));

        await redis.lpush(KEYS.DATA_LIST, taskList);

        let indexList = [];
        for (let i = 0 ; i < taskList.length; i ++) indexList.push(i);

        await redis.sadd(KEYS.INDEX, indexList);

        // 初始化overNum
        await redis.set(KEYS.OVER_NUM, 0);
    }
};

/**
 * 获取一个需要执行的seed
 * @returns {Promise<null>}
 */
exports.getOneSeed = async () => {
    let index = await redis.spop(KEYS.INDEX);

    if (index === null || index === undefined) return null;

    let seedStr = await redis.lindex(KEYS.DATA_LIST, index);

    return JSON.parse(seedStr);
};

/**
 * 获取需要执行的task的总数
 * @returns {Promise<*>}
 */
exports.totalTask = async () => {
    return await redis.llen(KEYS.DATA_LIST);
};

/**
 * 获取一个task任务数据
 * @returns {Promise<*>}
 */
exports.overOneTask = async () => {
    return await redis.incr(KEYS.OVER_NUM);
};

/**
 * 判断task是否都已经执行完毕
 * @returns {Promise<boolean>}
 */
exports.isComplete = async () => {
    let overTaskNum = await redis.get(KEYS.OVER_NUM);
    let totalTask = await redis.llen(KEYS.DATA_LIST);

    return parseInt(overTaskNum) >= totalTask;
};

/**
 * 获取任务完成相关信息
 * @returns {Promise<void>}
 */
exports.getProgressInfo = async () => {
    let overTaskNum = await redis.get(KEYS.OVER_NUM);
    let totalTaskNum = await redis.llen(KEYS.DATA_LIST);

    return {overTaskNum, totalTaskNum};
};