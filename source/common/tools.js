/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc 工具集合
 */
const fs            = require('fs');
const path          = require('path');
const _             = require('lodash');
const Promise       = require('bluebird');
const rp            = require('request-promise');

const logger        = require('./logger');
const config        = require('../config');
const {ERROR_OBJ}   = config;

/**
 * 抛出指定异常
 * @param errObj
 * @param errMsg
 * @param errData
 */
exports.threw = (errObj = ERROR_OBJ.DEFAULT, errMsg = '', errData = {}) => {
	let code = errObj.code && !isNaN(errObj.code) ? errObj.code : ERROR_OBJ.DEFAULT.code;
	let msg = errObj.msg || ERROR_OBJ.DEFAULT.msg;

	let err = new Error(msg);
	err.code = code;
	err.data = errData;

	throw err;
};

/**
 * 带超时的request
 * @param reqConf
 * @returns {Promise<*>}
 */
exports.timeoutRequest = async reqConf => {
	let timeout = reqConf && reqConf.hasOwnProperty('timeout') && !isNaN(reqConf.timeout) && reqConf.timeout > 0 ? reqConf.timeout : null;

	if (timeout) {
		return await new Promise(async (resolve, reject) => {
			try {
				let data = await rp(reqConf);
				resolve(data);
			} catch (err) {
				reject(err);
			}
		}).timeout(timeout);
	} else {
		return await rp(reqConf);
	}
};

/**
 * 将obj中的字段进行排序；对象里面的子对象不进行排序；
 * @param obj 需要排序的对象
 * @param direction 排序顺序；asc是按照字段名升序；desc是按照字段名降序；
 * @param firstField 新对象的第一个字段；
 * @returns {*}
 */
exports.sortObj = (obj, direction = 'asc', firstField) => {
	// 数组、空对象和非对象类型不进行排序，直接返回；
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

	let newObj = {};

	let keys = [];
	for (let key in obj) (!firstField || firstField && key !== firstField) && keys.push(key);
	keys = _.sortBy(keys);

	direction && direction === 'desc' && (keys = _.reverse(keys));

	firstField && obj.hasOwnProperty(firstField) && (newObj[firstField] = obj[firstField]);
	for (let key of keys) newObj[key] = obj[key];

	return newObj;
};

/**
 * 将一个对象扩展成.out文件所需的string格式；
 * @param obj 需要处理的对象
 * @param required 需要展示的字段名数组
 * @param unrequired 不需要展示的字段名数组
 * @returns {string}
 */
exports.spread = (obj, required, unrequired) => {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`obj非对象类型：${JSON.stringify(obj)}`);

	if (required && !Array.isArray(required) || unrequired && !Array.isArray(unrequired)) throw new Error(`required或者unrequired非数组类型！`);

	let raw = '';
	for (let key in obj) {
		let value = obj[key];

		if (required && required.indexOf(key) > -1 || !required && (!unrequired || unrequired && unrequired.indexOf(key) < 0)) {
			// 去掉头尾的空格以及\r \n \t
			typeof value === 'string' && key !== 'createdAt' && key !== 'date' && (value = value.replace(/\r|\n|\t|^\s|\s$|\|/g, ''));
			raw += `${value || ''}|`;
		}
	}

	return raw;
};

/**
 * 进度封装
 * @type {exports.Progress}
 */
exports.Progress = class {
	constructor(sumCount, successCount = 0, failedCount = 0, interval = 100, prefix = '\t') {
		this.sumCount = sumCount;
		this.successCount = successCount;
		this.failedCount = failedCount;
		this.interval = interval;
		this.prefix = prefix;

		this.counter = 0;
	}

	_show() {
		let completeCount = this.successCount + this.failedCount;
		if (this.counter >= this.interval || completeCount === 0 || completeCount === this.sumCount) {
			this.counter = 0;

			let completeRatio = (completeCount / this.sumCount * 100).toFixed(2);
			let failedRatio = completeCount ? `${(this.failedCount / completeCount * 100).toFixed(2)}%` : '--';


			logger.info(`${this.prefix}|进度：${completeCount}/${this.sumCount}|完成比例：${completeRatio}%|失败比例：${failedRatio}`);
		}
	}

	success() {
		this.counter += 1;
		this.successCount += 1;
		this._show();
	}

	fail() {
		this.counter += 1;
		this.failedCount += 1;
		this._show();
	}
};