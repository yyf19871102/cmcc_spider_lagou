/**
 * @auth yangyufei
 * @date 2018-12-04 16:42:02
 * @desc 校验抓取规则是否发生变化
 */
const Promise   = require('bluebird');
const nodemailer= require('nodemailer');
const moment    = require('moment');

const fetcher   = require('./fetcher');
const logger    = require('../common/logger');
const redis     = require('../db_manager/redis').redis;
const SysConf   = require('../config');
const dateFormat= require('../common/date_format');
const tools     = require('../common/tools');

class Checker {
	constructor(testMode) {
		this.KEYS = {
			CHECKER : `spider-${SysConf.NAME}:mail-ruleChecker`
		};

		this.testMode = testMode;
		// 发送邮箱配置
		this.transporter = nodemailer.createTransport(SysConf.MAIL.transporter);
	}

	/**
	 * sendMail方法Promise化
	 * @param mailOptions
	 * @return {Promise.<void>}
	 */
	async sendMail() {
		let self = this;

		let html = `<p>拉勾网网站规则发生改变，请及时调整代码！可能导致的原因有：</p>`
			+ '<p>1、http请求接口发生变化：如参数调整、请求方式变化、反爬机制等；</p>'
			+ '<p>2、页面结构发生变化：如html结构以及class调整导致无法定位元素等；</p>';

		// 邮件详情
		let mailOptions = {
			from    : SysConf.MAIL.from,
			to      : SysConf.MAIL.to,
			subject : `拉勾网规则变化通知`,
			html,
		};

		await new Promise((resolve, reject) => {
			self.transporter.sendMail(mailOptions, (err, msg) => {
				err ? reject(err) : resolve(msg);
			})
		});
	}

	/**
	 * 校验执行封装，只要有一次通过就ok
	 * @param func
	 * @return {Promise.<boolean>}
	 * @private
	 */
	async _wrap(func, errMsg = '校验失败！') {
		let retry = 3; // 重试次数

		let ps = [];
		let pass = false;
		for (let i = 0; i < retry; i++) {
			ps.push(func().then(res => {
				res && (pass = true);
			}).catch(err => {
				logger.warn(err);
			}));
		}
		await Promise.all(ps);

		!pass && logger.warn(errMsg);
		return pass;
	}

	/**
	 * 校验接口/页面规则
	 * @return {Promise.<boolean>}
	 */
	async run() {
		let pass = true;

		try {
			pass = await this._wrap(async () => {
				let {rongziList, industryList} = await fetcher.getChannels();

				return rongziList.length === 8 && industryList.length === 21;
			}, 'getChannels校验错误！');


			pass && (pass = await this._wrap(async () =>{
				let cityList = await fetcher.getCities();
				return cityList.length > 100;
			}, 'getCities校验错误！'));

			pass && (pass = await this._wrap(async () => {
				let corpsData = await fetcher.getCompanyList(1, 2);
				return corpsData.hasOwnProperty('result');
			}, '校验getCompanyList错误！'));

			pass && (pass = await this._wrap(async () => {
				let corpInfo = await fetcher.getCompanyInfo(52719);
				return corpInfo.hasOwnProperty('coreInfo');
			}, '校验getCompanyInfo错误！'));

			pass && (pass = await this._wrap(async () => {
				let jobList = await fetcher.getJobList(52719, 1);
				return jobList.state === 1;
			}, '校验getJobList错误！'));

			pass && (pass = await this._wrap(async () => {
				let jobInfo = await fetcher.getJobInfo('4749220');
				return jobInfo.hasOwnProperty('title');
			}, '校验getJobInfo错误！'));
		} catch (err) {
			logger.warn(err);

			pass = false;
		}

		if (!pass && !this.testMode) {
			let date = await redis.get(this.KEYS.CHECKER);

			if (!date || moment(date).diff(moment()) !== 1) {
				await this.sendMail();
				await redis.set(this.KEYS.CHECKER, dateFormat.getDate());
			}
		}

		return pass;
	}
}


module.exports = async (testMode = false) => {
	return await new Checker(testMode).run();
};