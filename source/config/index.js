/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc 配置文件
 *
 * //TODO 根据项目配置相关选项
 */
const _     = require('lodash');
const fs    = require('fs');
const path  = require('path');
const uuid  = require('uuid/v4');

const dateFormat = require('../common/date_format');

const ENV   = process.env.NODE_ENV || 'development';

let config = {
	NAME        : 'lagou', // 工程名同

	MONITOR     : true, // 默认加入监控当中
    SITE_NAME   : '拉勾网', // 主站中文名称，monitor监控时爬虫的名字

	AUTHOR      : [
        {name: 'yangyufe', startAt: '2019-01-09'},
    ],

	// 信源配置，每个信源对应一个接口/out文件
	XINYUAN     : {
		corpOut : {
			/**
			 * out文件名前缀；
			 * 建议和信源关键字一致
			 */
			key     : 'corp',

			/**
			 * schema详细使用见 https://github.com/epoberezkin/ajv
			 */
			schema  : {
				type: 'object',
				properties  : {
                    uuid    : {type: 'string'},
                    recType : {type: 'string', _default: '招聘'},
                    theSource: {type: 'string', _default: '拉勾网'},
                    url     : {type: 'string'},
                    date    : {type: 'string', _default: dateFormat.getDate},
                    ffdcreate: {type: 'string'},
                    title   : {type: 'string'},
                    recTypeSub: {type: 'string', _default: '拉钩'},
                    city    : {type: 'string'},
                    region  : {type: 'string'},
                    address : {type: 'string'},
                    lat     : {type: 'string'},
                    lng     : {type: 'string'},
                    tags    : {type: 'string'},
                    industry: {type: 'string'},
                    companySize: {type: 'string'},
                    financeStage: {type: 'string'},
                    name    : {type: 'string'},
                    companyShortName: {type: 'string'},
                    homepage: {type: 'string'},
                    companyIntroduce: {type: 'string'},
                    desc    : {type: 'string'},
                    collectionType: {type: 'string'},
				},
				required    : ['uuid']
			},
			// sort    : 'asc', // 输出文件是否排序

			/**
			 * 如果subDir存在，则生成一个子目录，子目录里面存放相关out文件
			 */
			subDir  : 'company', // 如果subDir存在，则生成一个子目录，子目录里面存放相关out文件
		},

        jobOut: {
		    key: 'job',
            schema: {
		        type: 'object',
                properties: {
                    uuid    : {type: 'string', _default: uuid},
                    recType : {type: 'string', _default: '招聘'},
                    theSource: {type: 'string', _default: '拉勾网'},
                    url     : {type: 'string'},
                    date    : {type: 'string', _default: dateFormat.getDate},
                    ffdcreate: {type: 'string'},
                    title   : {type: 'string'},
                    recTypeSub: {type: 'string', _default: 'lagou'},
                    subTitle: {type: 'string'},
                    title   : {type: 'string'},
                    salary  : {type: 'string'},
                    workAt  : {type: 'string'},
                    workExp : {type: 'string'},
                    eduLv   : {type: 'string'},
                    quanzhi : {type: 'string'},
                    tags    : {type: 'string'},
                    publishDate: {type: 'string'},
                    welfare : {type: 'string'},
                    desc    : {type: 'string'},
                    workAddr: {type: 'string'},
                    companyId: {type: 'string'},
                    jobId   : {type: 'string'},
                }
            },
            subDir  : 'zhiwei',
        }
	},

	// 过滤器配置
	FILTER      : {
		// annFilter   : {
		// 	name    : 'annNum', // 过滤器名字
		// 	type    : 1, // 过滤器类型
		// }
	},

	// 错误相关信息
	ERROR_OBJ   : {
		SUCCESS     : {code: 0, msg: '操作成功！'},

		DEFAULT     : {code: 100, msg: '系统错误！'},
		TIMEOUT     : {code: 101, msg: '请求访问超时！'},
		RETRYOUT    : {code: 102, msg: '超过最大重试次数！'},
		PARSEJSON   : {code: 103, msg: '异常非json数据！'},
		BAD_REQUEST : {code: 104, msg: 'uri请求错误！'},
		BAD_CONFIG  : {code: 105, msg: '配置错误！'},
		CHECK_RULE  : {code: 106, msg: '网站接口/页面规则校验不通过！'},
		BAD_OUTPUT  : {code: 107, msg: '输出数据校验失败！'}
	},

	// 网络监控相关keys
	NET_MONITOR_KEYS: {
		STATE_NET   : 'network:connect:state', // 当前网络基本状态
		NET_LAST_TEST: 'network:connect:lastTestTime', // 上次检查网络状态时间
		POOL        : 'network:proxy:pool', // 代理池
	},

	// 网络状态
	NET_STATE       : {
		DISCONNECT  : -1, // 网络不通
		GOOD        : 1, // 通畅
	},

	TASK_STATUS     : {
		BIG_RECORD  : -2, // 查询条件下数据过多，需要再次分割
		ERROR       : -1, // 失败
		WAITING     : 0, // 等待
		RUNNING     : 1, // 运行中
		SUCCESS     : 2, // 成功
	},

	OUT_FILE_SIZE   : 500, // 输出out文件的大小

	// 过滤器类型
	FILTER_TYPE     : {
		SIMPLE      : 1, // 简单过滤器
		EXPIRE      : 2, // 带过期的过滤器
	},

    // 必须分类细化查询的7个大城市：北京、上海、广州、深圳、成都、武汉、杭州
    BIG_CITY        : ['2', '3', '215', '213', '6', '252', '184'],

    CORP_PAGE_SIZE  : 16, // 公司导航页每页16条数据
    JOB_PAGE_SIZE   : 10, // 职位导航页每页10条数据
};

// 读取config目录下所有配置文件，并合并到system当中
fs.readdirSync(__dirname).forEach(fileName => {
	let stats = fs.statSync(path.join(__dirname, fileName));

	if (!stats.isDirectory() && fileName.startsWith(`${ENV}_`) && fileName.endsWith('.js')) {
		let key = fileName.replace(`${ENV}_`, '').replace('.js', '').toUpperCase();
		let value = require(path.join(__dirname, fileName));
		config.hasOwnProperty(key) ? _.merge(config[key], value) : (config[key] = value);
	}
});

/**
 * 开发环境中需要实时监控网络状态；
 * 生产环境中可以保证网络稳定，因此不需要开启此功能；
 * @type {boolean}
 */
config.NET_CONNECT_TEST = ENV === 'development';
config.NET_CONNECT_TEST = false;

// 生产环境中禁止自定义的test选项
ENV === 'production' && config.SPIDER && config.SPIDER.test && (delete config.SPIDER.test);

module.exports = config;