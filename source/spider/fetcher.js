/**
 * @auth yangyufei
 * @date 2018-12-04 16:34:30
 * @desc
 */
const cheerio   = require('cheerio');
const moment    = require('moment');
const uuid      = require('uuid/v4');

const utils     = require('../core/utils');
const SysConf   = require('../config');

const parseChannel = ($, selector) => {
	let list = [];

	$(selector).each(function () {
		let title = $(this).text();

		if (!/不限/.test(title)) {
			list.push({name: title.replace(/\s/g, ''), code: $(this).attr('data-id')});
		}
	});

	return list;
};

/**
 * 获取行业类型
 * @return {Promise.<{rongziList: Array, industryList: Array, corpSizeList: Array}>}
 */
exports.getChannels = async () => {
	let rongziList = [], corpSizeList = [], industryList = [];

	let reqConf = {
		uri     : 'https://www.lagou.com/gongsi/',
		method  : 'GET',
		transform: res => cheerio.load(res),
        headers : {
		    Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
        },
		useProxy: true,
	};

	let $ = await utils.requestUrl(reqConf, 1, $ => $('#filterCollapse').length > 0);

	rongziList = parseChannel($, '#filterCollapse > .financeStage a');
	industryList = parseChannel($, '#filterCollapse > .industry > .more-hy a');
	corpSizeList = parseChannel($, '#filterCollapse > .companysize a');

	return {rongziList, industryList, corpSizeList};
};

/**
 * 获取城市信息
 */
exports.getCities = async () => {
	let cityList = [];

	let reqConf = {
		uri     : 'http://www.lagou.com/gongsi/allCity.html?option=2-7-24',
		method  : 'GET',
		transform: res => cheerio.load(res),
        headers : {
            Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
        },
        useProxy: true
	};

	let $ = await utils.requestUrl(reqConf, 2, $ => $('.word_list').length > 0);

	$('.word_list tr').each(function () {
		$(this).find('.city_list li').each(function () {
			let href = $(this).find('a').attr('href');
			let tmp = href.split('/');

			let city = {
				name    : $(this).find('a').text(),
				code    : tmp[tmp.length - 1].split('-')[0]
			};

			cityList.push(city);
		})
	});

	return cityList;
};

/**
 * 获取公司列表
 * @param page 页码
 * @param cityCode 城市代码
 * @param rongziCode 融资选项码
 * @param industryCode 行业选项码
 * @param corpSizeCode 公司规模选项码
 * @return {Promise.<*>}
 */
exports.getCompanyList = async (page, cityCode, rongziCode = 0, industryCode = 0, corpSizeCode) => {
	if (page > 63) {
		logger.warn(`不允许查询大于63页的数据，city:${cityCode},rongzi:${rongziCode},industry:${industryCode},page:${page}`);
		return [];
	}

	let reqConf = {
		uri     : `https://www.lagou.com/gongsi/${cityCode}-${rongziCode}-${industryCode}-0.json`,
		method  : 'POST',
		form    : {
			first   : false,
			pn      : page,
			sortField: 1,
			havemark: 0,
		},
		headers : {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.108 Safari/537.36',
			Referer: `https://www.lagou.com/gongsi/${cityCode}-${rongziCode}-${industryCode}-0?sortField=1`,
            Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
		},
		json    : true,
		timeout : SysConf.SPIDER.fetch.timeout,
		useProxy: true
	};

	let data = await utils.requestUrl(reqConf, 2, res => res.hasOwnProperty('result'));

	return data;
};

/**
 * 获取公司json数据
 * @param corpId
 * @returns {Promise.<void>}
 */
exports.getCompanyInfo = async corpId => {
	let reqConf = {
		uri     : `http://www.lagou.com/gongsi/${corpId}.html`,
		method  : 'GET',
		timeout : 20000,
		transform: res => cheerio.load(res),
		useProxy: true,
		headers : {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.108 Safari/537.36',
			Referer: `http://www.lagou.com/gongsi/`,
            Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
		},
	};

	let $ = await utils.requestUrl(reqConf, 2, $ => $('#companyInfoData').length > 0);

	return JSON.parse($('#companyInfoData').html());
};

/**
 * 获取职位列表
 * @param corpId
 * @param page
 * @returns {Promise.<*>}
 */
exports.getJobList = async (corpId, page, isSchool = false) => {
	let reqConf = {
		uri     : `https://www.lagou.com/gongsi/searchPosition.json`,
		method  : 'POST',
		json    : true,
		useProxy: true,
		timeout : SysConf.SPIDER.fetch.timeout,
		form: {
			companyId   : corpId,
			positionFirstType: '全部',
			schoolJob   : isSchool,
			pageNo      : page,
			pageSize    : 100,
		},
		headers : {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.108 Safari/537.36',
			Referer: `http://www.lagou.com/gongsi/`,
            Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
		},
	};

	let data = await utils.requestUrl(reqConf, 2, data => data.hasOwnProperty('state') && data.state === 1);

	return data;
};

/**
 * 获取职位信息
 * @param jobId
 * @return {Promise.<{}>}
 */
exports.getJobInfo = async jobId => {
	let reqConf = {
		uri     : `http://www.lagou.com/jobs/${jobId}.html`,
		method  : 'GET',
		useProxy: true,
		timeout : SysConf.SPIDER.fetch.timeout,
		transform: res => cheerio.load(res),
		headers : {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.108 Safari/537.36',
            Cookie: `user_trace_token=${moment().format('YYYYMMDDHHmmss')}-${uuid()}`
		},
	};

	let job = {};

	let $ = await utils.requestUrl(reqConf, 2, $ => $('.job-name .company').length > 0);

	job.subTitle = $('.job-name .company').text();
	job.title = $('.job-name .name').text();

	$('.job_request > p > span').each(function (index) {
		let value = $(this).text().replace(/\r|\n|\t|\s|\||\//g, '');
		switch(index) {
			case 0 : job.salary = value; break;
			case 1 : job.workAt = value; break;
			case 2 : job.workExp = value; break;
			case 3 : job.eduLv = value; break;
			case 4 : job.quanzhi = value; break;
		}
	});

	let tags = [];
	$('.position-label li').each(function () {
		tags.push($(this).text())
	});
	job.tags = tags;

	let publishDate = $('.publish_time').text();
	if (publishDate.indexOf('-')) {}
	job.publishDate = publishDate.indexOf('-') > -1 ? publishDate.replace(/\s|发布于拉勾网/g, '') : moment().format('YYYY-MM-DD');

	job.welfare = $('.job-advantage p').text();
	job.desc = $('.job_bt div').text().replace(/\r|\n|\t|\s|\|/g, '');
	job.workAddr = $('.work_addr').text().replace(/\r|\n|\t|\s|\|/g, '');

	return job;
};