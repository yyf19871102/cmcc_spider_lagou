/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc 输出封装
 */
const uuid      = require('uuid/v4');
const _         = require('lodash');
const fs        = require('fs');
const path      = require('path');
const Promise   = require('bluebird');
const mkdirp    = require('mkdirp');
const mkdirpAsync = Promise.promisify(mkdirp);
const moment    = require('moment');
const Ajv       = require('ajv');
const ajv       = new Ajv({useDefaults: true, removeAdditional: true});

const SysConf   = require('../config');
const dateFormat= require('../common/date_format');
const tools     = require('../common/tools');
const redis     = require('../db_manager/redis').redis;
const utils     = require('./utils');
const keyManager= require('./key_manager');
const logger    = require('../common/logger');

class Output {
	constructor(xinyuan) {
		this.xinyuan = xinyuan;
		this.validator  = ajv.compile(xinyuan.schema);

		let prefix =  utils.makeNameSpace();
		this.KEYS = {
			OUTPUT  : `${prefix}:output-${xinyuan.key}:result`,
		};

		this.destDir = null; // out文件根目录
	}

	// 初始化
	async init() {
		// 管理key
		await keyManager.saveKeyObject(this.KEYS);

		// out文件输出目录
		this.destDir = path.join(SysConf.SPIDER.outDir, SysConf.SPIDER.dirName || SysConf.NAME);

		// 是否生成子目录
		this.xinyuan.subDir && (this.destDir = path.join(this.destDir, this.xinyuan.subDir));
	}

	/**
	 * 校验结果
	 * @param record
	 * @return {Promise.<string>}
	 */
	validate(record) {
		// 校验
		if (this.validator(record)) return null;

		let result = {};
		_.keys(this.xinyuan.schema.properties).forEach(key => {
		    result[key] = record.hasOwnProperty(key) ? result[key] : '';
		    if (record.hasOwnProperty(key)) {
                result[key] = record[key];
            } else if (this.xinyuan.schema.properties[key].hasOwnProperty('_default')) {
                if (typeof this.xinyuan.schema.properties[key]._default === 'function') {
                    result[key] = this.xinyuan.schema.properties[key]._default();
                } else {
                    result[key] = this.xinyuan.schema.properties[key]._default;
                }
            } else {
                result[key] = '';
            }
        });

		// 排序
		this.xinyuan.sort && (this.xinyuan.sort === 'asc' || this.xinyuan.sort === 'desc') && (result = tools.sortObj(result, this.xinyuan.sort));
		return tools.spread(result) + '#\r\n';
	}

	/**
	 * 写out文件
	 * @return {Promise.<void>}
	 */
	async writeFile() {
		let destDir = path.join(this.destDir, dateFormat.getDate());

		// 生成文件夹
		!fs.existsSync(destDir) && await mkdirpAsync(destDir);

		// 写入的文件名
		let uuidStr = uuid();
		let fileName = `${this.xinyuan.key}-${moment().format('YYYYMMDDHHmmssSSS')}-${uuid()}.out`;
		let destFile = path.join(destDir, fileName);

		/**
		 * 没有使用smembers；即便此时被ctr+c中断，最多只会丢失1条数据；
		 * smembers有可能最多丢失OUT_FILE_SIZE条数据；
		 * @type {string}
		 */
		let outStr = '';
		while(true) {
			if (await redis.scard(this.KEYS.OUTPUT) <= 0) break;
			outStr += await redis.spop(this.KEYS.OUTPUT);
		}
		outStr && fs.appendFileSync(destFile, outStr);
	}

	/**
	 * 将数据写入out文件
	 * @param dataList
	 * @return {Promise.<void>}
	 */
	async write(dataList) {
		for (let record of dataList) {
			let str = this.validate(record);
			str && await redis.sadd(this.KEYS.OUTPUT, str);
		}


		await redis.scard(this.KEYS.OUTPUT) >= SysConf.OUT_FILE_SIZE && await this.writeFile();
	}

	/**
	 * 清除残留数据
	 * @return {Promise.<void>}
	 */
	async clear() {
		await this.writeFile();
	}
}

/**
 * 加载所有output
 * 如果有多个信源的key相同，则后面的output会覆盖前面的output
 * @return {Promise.<{}>}
 */
exports.getOutputManager = async () => {
	_.keys(SysConf.XINYUAN).length < 1 && logger.warn('xinyuan为空');

	let outputManager = {};

	for (let xinyuanKey in SysConf.XINYUAN) {
		let xinyuan = SysConf.XINYUAN[xinyuanKey];

		let output = new Output(xinyuan);
		await output.init();
		outputManager[xinyuanKey] = output;
	}

	return outputManager;
};