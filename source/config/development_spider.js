/**
 * @auth yangyufei
 * @date 2018-11-24 10:59:33
 * @desc
 */
module.exports = {
	out     : {
		corpDir     : 'd://tmp/lagou/company/',
		cropPrefix  : 'lagouCompany',
		jobDir      : 'd://tmp/lagou/zhiwei/',
		jobPrefix   : 'lagouZhiweis',

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

	testCity: [
		{code : '167', name: '郑州'},
	],

	run     : {
		type: 'once',
	},
};