/**
 * @auth yangyufei
 * @date 2018-12-10 16:47:17
 * @desc 清理爬虫数据
 */
const keyManager    = require('./spider/key_manager');
const logger        = require('./common/logger');

keyManager.clearAllKeys().then(() => {
	logger.info('清理爬虫数据成功！');
	process.exit(0);
}).catch(err => {
	logger.warn('清理爬虫数据失败！');
	logger.error(err);
	process.exit(0);
});