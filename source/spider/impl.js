/**
 * @author  yangyufei
 * @date    2019-01-05 15:53:18
 * @desc
 */
const Promise       = require('bluebird');
const _             = require('lodash');

const phaseManager  = require('../core/phase');
const fetcher       = require('./fetcher');
const SysConf       = require('../config');
const logger        = require('../common/logger');

exports.makeMacroTasks = async () => {
    return SysConf.SPIDER.test || await fetcher.getCities();
};

exports.makePhaseList = async (context, sid) => {
    let {corpOut, jobOut} = context.outputManager;
    // let corpOut = context.outputManager.corpOut;

    let phaseList = [];

    // 根据城市和融资、行业类型生成公司导航页抓取的基本参数（无page参数）
    let phaseMakeBaseCorpParams = await phaseManager.getOnePhase(sid, 'makeBaseCorpParams', 1);
    // 生成公司导航页抓取的全部参数（有page参数）
    let phaseMakeExtCorpParams = await phaseManager.getOnePhase(sid, 'makeExtCorpParams', 2);
    // 抓取公司导航页
    let phaseGetCorpList = await phaseManager.getOnePhase(sid, 'getCorpList', 3);
    // 抓取公司详情页
    let phaseGetCorpInfo = await phaseManager.getOnePhase(sid, 'getCorpInfo', 4);
    // 抓取岗位导航页
    let phaseGetJobList = await phaseManager.getOnePhase(sid, 'getJobList', 5);
    // 抓取岗位详情页
    let phaseGetJobInfo = await phaseManager.getOnePhase(sid, 'getJobInfo', 6);

    phaseList = [
        phaseMakeBaseCorpParams,
        phaseMakeExtCorpParams,
        phaseGetCorpList,
        phaseGetCorpInfo,
        phaseGetJobList,
        phaseGetJobInfo
    ];

    let rongziList = [
        {name: '未融资', code: 1},
        {name: '天使轮', code: 2},
        {name: 'A轮', code: 3},
        {name: 'B轮', code: 4},
        {name: 'C轮', code: 5},
        {name: 'D轮及以上', code: 6},
        {name: '上市公司', code: 7},
        {name: '不需要融资', code: 8},
    ];

    let industryList = [
        {name: '移动互联网', code: 24},
        {name: '电子商务', code: 25},
        {name: '金融', code: 33},
        {name: '企业服务', code: 27},
        {name: '教育', code: 29},
        {name: '文化娱乐', code: 45},
        {name: '游戏', code: 31},
        {name: 'O2O', code: 28},
        {name: '硬件', code: 47},
        {name: '健康医疗', code: 34},
        {name: '生活服务', code: 35},
        {name: '广告营销', code: 43},
        {name: '旅游', code: 32},
        {name: '数据服务', code: 41},
        {name: '社交网络', code: 26},
        {name: '分类信息', code: 48},
        {name: '信息安全', code: 38},
        {name: '招聘', code: 49},
        {name: '区块链', code: 15793},
        {name: '人工智能', code: 15794},
        {name: '其它', code: 10594},
    ];

    phaseMakeBaseCorpParams.setHandler(async city => {
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

        await phaseMakeExtCorpParams.insertTasks(paramsList);
    });

    phaseMakeExtCorpParams.setHandler(async baseParam => {
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

        await phaseGetCorpList.insertTasks(paramsList);
        await phaseGetCorpInfo.insertTasks(baseCorpList);
    });

    phaseGetCorpList.setHandler(async corpNaviParam => {
        let rongzi = corpNaviParam.rongzi ? corpNaviParam.rongzi.code : 0;
        let industry = corpNaviParam.industry ? corpNaviParam.industry.code : 0;

        let corpNaviData = await fetcher.getCompanyList(corpNaviParam.page, corpNaviParam.city.code, rongzi, industry);

        await phaseGetCorpInfo.insertTasks(corpNaviData.result.map(corp => {
            return {id: corp.companyId, cityCode: corpNaviParam.city.code}
        }));
    });

    phaseGetCorpInfo.setHandler(async baseCorp => {
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

        await corpOut.write([corpInfo]);

        let jobParams = [];
        let totalJobPage = Math.ceil(corpData.dataInfo.positionCount / SysConf.JOB_PAGE_SIZE);
        let totalSchoolJobPage = Math.ceil(corpData.dataInfo.schoolPositionCount / SysConf.JOB_PAGE_SIZE);

        for (let page = 1; page <= totalJobPage; page++) jobParams.push({isSchool: false, page, corpId: baseCorp.id});
        for (let page = 1; page <= totalSchoolJobPage; page++) jobParams.push({isSchool: true, page, corpId: baseCorp.id});

        await phaseGetJobList.insertTasks(jobParams);
    });

    phaseGetJobList.setHandler(async jobParam => {
        let data = await fetcher.getJobList(jobParam.corpId, jobParam.page, jobParam.isSchool);

        let jobList = [];
        data.content.data.page.result.forEach(record => {
            jobList.push({
                corpId  : jobParam.corpId,
                jobId   : record.positionId,
            });
        });

        await phaseGetJobInfo.insertTasks(jobList);
    });

    phaseGetJobInfo.setHandler(async baseJobInfo => {
        let jobInfo = await fetcher.getJobInfo(baseJobInfo.jobId);
        jobInfo.companyId = baseJobInfo.corpId;
        jobInfo.jobId = baseJobInfo.jobId;

        jobInfo.test = 'aaa';

        await jobOut.write([jobInfo], false);
    });

    return phaseList;
};