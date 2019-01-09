/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc log4js配置
 */
const log4js	= require('log4js');
const path      = require('path');

// log4js配置
let config	= {
	appenders   : {
		console : { type: 'console' },  //控制台输出
		file    :{
			type    : 'dateFile',       //文件输出
			filename: path.join(__filename, '..', '..', '..', 'logs', 'app.log'),   //默认在根目录的logs下
			pattern : '.yyyy-MM-dd'
		},
	},
	categories: {
		default     : {appenders: ['console', 'file'], level: 'info'}
	}
};

log4js.configure(config);

module.exports = log4js.getLogger();