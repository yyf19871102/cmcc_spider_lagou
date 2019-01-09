/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc 爬虫相关配置
 */
module.exports = {
    outDir  : '/home/wltx/out/', // 输出文件根路径

    threadNum: 4, // 开启线程数量

    keywordOfSeed: 'name', // 打印日志时，显示当前执行的seed的关键字段

	fetch   : {
		timeout     : 20000,
		retry       : 3,
	},

	task    : {
		concurrency : 100,
		retry       : 2,
	},

	run     : {
		type: 'cron',
		cron: '0 15 0 * * *'
	},
};