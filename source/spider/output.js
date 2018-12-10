/**
 * @auth yangyufei
 * @date 2018-12-05 08:19:37
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

const SysConf   = require('../config');
const dateFormat= require('../common/date_format');
const tools     = require('../common/tools');

class Output {
	constructor() {
		this.corpCache = [];
		this.jobCache = [];
	}

	/**
	 * 校验公司信息
	 * @param corp
	 * @return {*}
	 */
	validateCorpData(corp) {
		let data = {
			uuid    : uuid(),
			recType : '招聘',
			theSource: '拉勾网',
			url     : '',
			date    : dateFormat.getDateTime(),
			ffdcreate: '',
			title   : '',
			recTypeSub: 'lagou',
			city    : '',
			region  : '',
			address : '',
			lat     : '',
			lng     : '',
			tags    : '',
			industry: '',
			companySize: '',
			financeStage: '',
			name    : '',
			companyShortName: '',
			homepage: '',
			companyIntroduce: '',
			desc    : '',
			collectionType: '',
		};

		let keys = _.keys(data);
		keys.forEach(key => {
			corp.hasOwnProperty(key) && (data[key] = corp[key]);
		});

		let str = tools.spread(data) + '#\r\n';

		return data.name ? str : null;
	}

	/**
	 * 校验岗位信息
	 * @param job
	 * @return {*}
	 */
	validateJobData(job) {
		let data = {
			uuid    : uuid(),
			recType : '招聘',
			theSource: '拉勾网',
			url     : `https://www.lagou.com/jobs/${job.jobId}.html`,
			date    : dateFormat.getDateTime(),
			ffdcreate: '',
			title   : '',
			recTypeSub: 'lagou',
			subTitle: '',
			title   : '',
			salary  : '',
			workAt  : '',
			workExp : '',
			eduLv   : '',
			quanzhi : '',
			tags    : '',
			publishDate: '',
			welfare : '',
			desc    : '',
			workAddr: '',
			companyId: '',
			jobId   : '',
		};

		let keys = _.keys(data);
		keys.forEach(key => {
			job.hasOwnProperty(key) && (data[key] = job[key]);
		});

		let str = tools.spread(data) + '#\r\n';

		return data.title ? str : null;
	}

	/**
	 * 写out文件
	 * @param isCorp
	 * @return {Promise.<void>}
	 */
	async writeFile(isCorp = true) {
		let cache = isCorp ? this.corpCache : this.jobCache;

		let destDir = path.join(isCorp ? SysConf.SPIDER.out.corpDir : SysConf.SPIDER.out.jobDir, dateFormat.getDate());

		!fs.existsSync(destDir) && await mkdirpAsync(destDir);

		let uuidStr = uuid();
		let fileName = `${isCorp ? SysConf.SPIDER.out.cropPrefix : SysConf.SPIDER.out.jobPrefix}-${moment().format('YYYYMMDDHHmmssSSS')}-${uuid()}.out`;
		let destFile = path.join(destDir, fileName);

		let outStr = '';
		cache.forEach(record => outStr += record);
		fs.appendFileSync(destFile, outStr);


		isCorp ? (this.corpCache = []) : (this.jobCache = []);
	}

	/**
	 * 将数据写入out文件
	 * @param dataList
	 * @param isCorp
	 * @return {Promise.<void>}
	 */
	async write(dataList, isCorp = true) {
		let cache = isCorp ? this.corpCache : this.jobCache;

		dataList.forEach(record => {
			let str = isCorp ? this.validateCorpData(record) : this.validateJobData(record);
			str && cache.push(str);
		});

		cache.length >= SysConf.OUT_FILE_SIZE && await this.writeFile(isCorp);
	}

	async clear(isCorp = true) {
		await this.writeFile(isCorp);
	}
}

module.exports = new Output();