/**
 * @auth yangyufei
 * @date 2018-12-08 10:24:08
 * @desc
 */
module.exports = {
	cronTab     : '0 0 8 * * *', // 发送邮件时间
	// 邮箱代理
	transporter : {
		host    : 'smtp.163.com',
		port:    465,
		secure  :true,
		auth    : {
			user: 'yyf19871102@163.com', // 邮箱号
			pass: '0601114034' // 密码
		}
	},

	from        : 'yyf19871102@163.com', // 发送人
	to          : 'yyf19871102@163.com', // 接受人
};