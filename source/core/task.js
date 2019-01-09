/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc
 */
const _             = require('lodash');

const logger        = require('../common/logger');
const tools         = require('../common/tools');
const SysConf       = require('../config');
const {ERROR_OBJ}   = SysConf;
const impl          = require('../spider/impl');
const dispatcher    = require('./dispatcher');
const outputManager = require('./output');
const filterManager = require('./filter');

class Task {
	constructor(sid) {
	    this.sid = sid;
		this.context = {};

		this.phaseList = [];
	}

	/**
	 * 初始化
	 * @return {Promise.<void>}
	 */
	async init() {
		if (!impl.makePhaseList || typeof impl.makePhaseList !== 'function') {
			tools.threw(ERROR_OBJ.BAD_CONFIG, 'impl中未配置makePhaseList方法！')
		}

        // 初始化output和filter
        this.context.outputManager = await outputManager.getOutputManager();
        this.context.filterManager = await filterManager.get();

		// 生成各个阶段
		this.phaseList = await impl.makePhaseList(this.context, this.sid);
	}

    /**
     * 是否需要seed
     * @returns {Promise<boolean>}
     */
	async needSeed() {
	    return this.phaseList.length > 0 && !await this.phaseList[0].isCreated()
    }

    /**
     * 设置seed
     * @param seed
     * @returns {Promise<void>}
     */
	async setSeed(seed) {
        await this.phaseList[0].insertTasks([seed]);
    }

	/**
	 * 运行各个阶段的任务
	 * @return {Promise.<void>}
	 */
	async run() {
        // 取出seed，并设置各个阶段的打印输出keyword
        if (impl.makeMacroTasks) {
            let keyword = '';

            let keywordName = SysConf.SPIDER.keywordOfSeed;
            if (keywordName) {
                let seed = await this.phaseList[0].getSeed();

                keyword = seed.hasOwnProperty(keywordName) ? seed[keywordName] : JSON.stringify(seed);

                this.phaseList.forEach(phase => {
                    phase.setKeyword(keyword);
                })
            }
        }

		for (let no = 0 ; no < this.phaseList.length; no++) {
			let phase = this.phaseList[no];
			await phase.run();
		}

		// 清除所有output中残留的数据
		for (let outputKey in this.context.outputManager) {
			let output = this.context.outputManager[outputKey];
            await output.clear();
		}

        for (let phase of this.phaseList) await phase.clear();
	}
}

/**
 * 获取任务管理器
 * @param seed
 * @param context
 * @return {Promise.<Task>}
 */
exports.get = async sid => {
	let task = new Task(sid);
	await task.init();

	return task;
};