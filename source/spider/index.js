/**
 * @auth yangyufei
 * @date 2018-12-04 16:31:14
 * @desc
 */
const _             = require('lodash');
const Promise       = require('bluebird');
const schedule      = require('node-schedule');

const TaskManager   = require('./task_manager');
const fetcher       = require('./fetcher');
const SysConf       = require('../config');
const output        = require('./output');
const Dispatcher    = require('./dispatcher');
const logger        = require('../common/logger');

class Impl {
	constructor(seed, context) {
		this.seed = seed;
		this.context = context;
	}

	async init() {
		let self = this;

		// 根据城市和融资、行业类型生成公司导航页抓取的基本参数（无page参数）
		this.phaseMakeBaseCorpParams = await TaskManager.getOneTaskManager('makeBaseCorpParams', 1);
		// 生成公司导航页抓取的全部参数（有page参数）
		this.phaseMakeExtCorpParams = await TaskManager.getOneTaskManager('makeExtCorpParams', 2);
		// 抓取公司导航页
		this.phaseGetCorpList = await TaskManager.getOneTaskManager('getCorpList', 3);
		// 抓取公司详情页
		this.phaseGetCorpInfo = await TaskManager.getOneTaskManager('getCorpInfo', 4);
		// 抓取岗位导航页
		this.phaseGetJobList = await TaskManager.getOneTaskManager('getJobList', 5);
		// 抓取岗位详情页
		this.phaseGetJobInfo = await TaskManager.getOneTaskManager('getJobInfo', 6);

		this.phaseList = [
			this.phaseMakeBaseCorpParams,
			this.phaseMakeExtCorpParams,
			this.phaseGetCorpList,
			this.phaseGetCorpInfo,
			this.phaseGetJobList,
			this.phaseGetJobInfo
		];

		let rongziList, industryList;
		while(true) {
			// 频道信息一定要获取到，不然7个大城市数据无法获取
			try {
				let channel = await fetcher.getChannels();

				rongziList = channel.rongziList;
				industryList = channel.industryList;

				break;
			} catch (err) {
				logger.warn('miacro task init阶段无法获取频道信息，5s后重试...');
				await Promise.delay(5000);
			}
		}

		!await this.phaseMakeBaseCorpParams.isCreated() && await this.phaseMakeBaseCorpParams.insertTasks([this.seed]);

		this.phaseMakeBaseCorpParams.setHandler(async city => {
			let paramsList = [];

			if (SysConf.BIG_CITY.indexOf(city.code) > -1) {
				for (let rongzi of rongziList) {
					for (let industry of industryList) {
						paramsList.push({rongzi, industry, city});
					}
				}
			} else {
				paramsList.push({city});
			}

			await self.phaseMakeExtCorpParams.insertTasks(paramsList);
		});

		this.phaseMakeExtCorpParams.setHandler(async baseParam => {
			let rongzi = baseParam.rongzi ? baseParam.rongzi.code : 0;
			let industry = baseParam.industry ? baseParam.industry.code : 0;

			let paramsList = [];
			let baseCorpList = [];

			let corpNaviData = await fetcher.getCompanyList(1, baseParam.city.code, rongzi, industry);

			let totoalPage = Math.ceil(parseInt(corpNaviData.totalCount) / SysConf.CORP_PAGE_SIZE);
			totoalPage >= 63 && (totoalPage = 63);

			for (let page = 2; page <= totoalPage; page++) paramsList.push(_.merge({}, baseParam, {page}));

			corpNaviData.result.forEach(corp => {
				baseCorpList.push({id: corp.companyId, cityCode: baseParam.city.code});
			});

			await self.phaseGetCorpList.insertTasks(paramsList);
			await self.phaseGetCorpInfo.insertTasks(baseCorpList);
		});

		this.phaseGetCorpList.setHandler(async corpNaviParam => {
			let rongzi = corpNaviParam.rongzi ? corpNaviParam.rongzi.code : 0;
			let industry = corpNaviParam.industry ? corpNaviParam.industry.code : 0;

			let corpNaviData = await fetcher.getCompanyList(corpNaviParam.page, corpNaviParam.city.code, rongzi, industry);

			await self.phaseGetCorpInfo.insertTasks(corpNaviData.result.map(corp => {
				return {id: corp.companyId, cityCode: corpNaviParam.city.code}
			}));
		});

		this.phaseGetCorpInfo.setHandler(async baseCorp => {
			let corpData = await fetcher.getCompanyInfo(baseCorp.id);

			let address = corpData.addressList && corpData.addressList.length > 0 ? corpData.addressList[0] : {};
			let corpInfo = {
				url     : `https://www.lagou.com/gongsi/${baseCorp.cityCode}-0-0-0`,
				city    : address.city,
				region  : address.district,
				address : address.detailAddress,
				lat     : address.lat,
				lng     : address.lng,
				tags    : corpData.labels ? corpData.labels.join() : '',
				industry: corpData.baseInfo.industryField,
				companySize: corpData.baseInfo.companySize,
				financeStage: corpData.baseInfo.financeStage,
				name    : corpData.coreInfo.companyName,
				companyShortName: corpData.coreInfo.companyShortName,
				homepage: corpData.coreInfo.companyUrl,
				companyIntroduce: corpData.coreInfo.companyIntroduce,
				desc    : corpData.introduction.companyProfile,
				collectionType: false,
				uuid    : baseCorp.id,
			};

			await output.write([corpInfo]);

			let jobParams = [];
			let totalJobPage = Math.ceil(corpData.dataInfo.positionCount / SysConf.JOB_PAGE_SIZE);
			let totalSchoolJobPage = Math.ceil(corpData.dataInfo.schoolPositionCount / SysConf.JOB_PAGE_SIZE);

			for (let page = 1; page <= totalJobPage; page++) jobParams.push({isSchool: false, page, corpId: baseCorp.id});
			for (let page = 1; page <= totalSchoolJobPage; page++) jobParams.push({isSchool: true, page, corpId: baseCorp.id});

			await self.phaseGetJobList.insertTasks(jobParams);
		});

		this.phaseGetJobList.setHandler(async jobParam => {
			let data = await fetcher.getJobList(jobParam.corpId, jobParam.page, jobParam.isSchool);

			let jobList = [];
			data.content.data.page.result.forEach(record => {
				jobList.push({
					corpId  : jobParam.corpId,
					jobId   : record.positionId,
				});
			});

			await self.phaseGetJobInfo.insertTasks(jobList);
		});

		this.phaseGetJobInfo.setHandler(async baseJobInfo => {
			let jobInfo = await fetcher.getJobInfo(baseJobInfo.jobId);
			jobInfo.companyId = baseJobInfo.corpId;
			jobInfo.jobId = baseJobInfo.jobId;

			await output.write([jobInfo], false);
		});
	}

	async run() {
		for (let no = 0 ; no < this.phaseList.length; no++) {
			let phase = this.phaseList[no];
			await phase.run();
		}

		// 不管是不是停止状态，都需要将内存中已经生成的数据flush掉
		await output.clear(true);
		await output.clear(false);
	}

	async clear() {
		for (let phase of this.phaseList) await phase.delete();
	}
}

const run = async () => {
	let spider = new Dispatcher(Impl);
	await spider.init();
	await spider.run();
	await spider.deleteAll();
};

if (SysConf.SPIDER.run.type === 'once') {
	run();
} else if (SysConf.SPIDER.run.type === 'cron') {
	schedule.scheduleJob(SysConf.SPIDER.run.cron, run);
} else {
	logger.warn(`错误的run type选项：${SysConf.SPIDER.run.type}`);
}