/**
 * @auth yangyufei
 * @date 2018-12-04 12:53:28
 * @desc
 */
const _     = require('lodash');
const fs    = require('fs');
const path  = require('path');

const ENV   = process.env.NODE_ENV || 'development';

let config = {
	NAME        : 'lagou',

	META        : {
		OUTKEY_JOB  : 'lagouZhiwei',
		OUTKEY_CORP : 'lagouCorp',
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
	},

	// 网络监控相关keys
	NET_MONITOR_KEYS: {
		STATE_NET   : 'network:base:state', // 当前网络基本状态
		NET_LAST_TEST: 'network:base:last-test-time', // 上次检查网络状态时间
		STATE_PROXY : 'network:proxy-state', // 当前代理源状态
		POOL        : 'network:proxy-pool', // 代理池
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

	CORP_PAGE_SIZE  : 16, // 公司导航页每页16条数据
	JOB_PAGE_SIZE   : 10, // 职位导航页每页10条数据

	// 必须分类细化查询的7个大城市：北京、上海、广州、深圳、成都、武汉、杭州
	BIG_CITY        : ['2', '3', '215', '213', '6', '252', '184'],

	OUT_FILE_SIZE   : 500, // 输出out文件的大小
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

module.exports = config;