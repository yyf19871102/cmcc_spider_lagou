/**
 * @author  yangyufei
 * @date    2019-01-05 10:17:51
 * @desc
 */
const cluster       = require('cluster');
const Promise       = require('bluebird');
const schedule      = require('node-schedule');

const dispatcher    = require('./core/dispatcher');
const SysConf       = require('./config');
const logger        = require('./common/logger');
const task          = require('./core/task');
const keyManager    = require('./core/key_manager');

const COMMANDS = {
    START   : 'master:start', // master向各个slave发送开始执行任务的命令
    OVER    : 'slave:over', // slave向master汇报任务执行结束
};

/**
 * master的run方法
 * 初始化task列表，然后向slave发送抓取信号
 * @param workers
 * @returns {Promise<void>}
 */
const run = async workers => {
    await dispatcher.init();

    for (let wid in workers) {
        workers[wid].send(COMMANDS.START);
    }
};

/**
 * slave执行task任务
 * @returns {Promise<void>}
 */
const runTask = async () => {
    let sid = process.env.spiderId;

    while (true) {
        let tm = await task.get(sid);

        /**
         * 两种情况：
         * 1.断点后继续运行，则现将上次的task运行完毕，此种情况下不需要seed；因为这一次已经取过seed了；
         * 2.非断点情况（如运行万一个task），则需要取出一个seed；
         */
        if (await tm.needSeed()) {
            let seed = await dispatcher.getOneSeed();

            if (!seed) {
                // task取完，向master发送结束信号，并跳出循环
                process.send(`${COMMANDS.OVER}@${sid}`);
                logger.info(`process-${sid} 执行结束！`);
                break;
            }

            await tm.setSeed(seed);
        }

        await tm.run();
        await dispatcher.overOneTask();
    }
};

/**
 * master处理slave的执行结束信号
 * @param spiderId
 * @param workers
 * @returns {Promise<void>}
 */
const handlerForOverTask = async (spiderId, workers) => {
    if (await dispatcher.isComplete()) {
        logger.info(`${SysConf.NAME}抓取结束。`);
        await keyManager.clearAllKeys();

        // 如果是forever模式，则再次向slave发送抓取命令
        if (SysConf.SPIDER.run.type === 'forever') {
            await Promise.delay(10 * 60 * 1000);
            await run(workers);
        }
    }
};

if (cluster.isMaster) {
    // 衍生工作进程。
    for (let i = 0; i < SysConf.SPIDER.threadNum; i++) {
        cluster.fork({spiderId: i});
    }

    if (SysConf.SPIDER.run.type === 'once' || SysConf.SPIDER.run.type === 'forever') {
        logger.info('=============================================');

        logger.info(`开始抓取${SysConf.NAME}...`);

        run(cluster.workers);
    } else if (SysConf.SPIDER.run.type === 'cron') {
        schedule.scheduleJob(SysConf.SPIDER.run.cron, async () => {
            await run(cluster.workers);
        });
    } else {
        logger.warn(`错误的run type选项：${SysConf.SPIDER.run.type}`);
    }

    for (let workerId in cluster.workers) {
        // 处理slave发送的结束信号
        cluster.workers[workerId].on('message', async msg => {
            if (typeof msg === 'string') {
                let arr = msg.split('@');
                let command = arr[0], spiderId = arr[1];

                switch(command) {
                    case COMMANDS.OVER: await handlerForOverTask(spiderId); break;

                    default: logger.warn(`unresolved command:${command}, by:${spiderId}`);
                }
            }
        })
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`工作进程 ${worker.process.pid} 已退出`);
    });
} else {
    process.on('message', async msg => {
        switch(msg) {
            case COMMANDS.START: await runTask(); break;
            default: logger.warn(`unresolved command:${command}, by: master`);
        }
    });
}