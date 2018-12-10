/**
 * @auth yangyufei
 * @date 2018-05-21 20:57:23
 * @desc 连接redis
 */
const redisConnector= require('./redis_connector');

exports.redis       = redisConnector.getInstance();
exports.publisher   = redisConnector.getInstance();
exports.subscriber  = redisConnector.getInstance();