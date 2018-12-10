/**
 * @auth yangyufei
 * @date 2018-12-08 10:25:21
 * @desc
 */
module.exports = {
	out     : {
		corpDir     : '/home/wltx/out/lagou/company/',
		jobDir      : '/home/wltx/out/lagou/zhiwei/',
		namePrefix  : 'lagou',
	},

	fetch   : {
		timeout     : 20000,
		retry       : 5,
	},

	task    : {
		concurrency : 100,
		retry       : 5,
	},

	run     : {
		type: 'cron',
		cron: '0 15 0 * * *'
	},
};