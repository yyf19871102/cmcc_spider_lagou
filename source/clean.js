/**
 * @auth {{author}}
 * @date {{dateTime}}
 * @desc 清理爬虫相关数据
 */
const program   = require('commander');
const path      = require('path');
const chalk     = require('chalk');
const inquirer  = require('inquirer');

const filterManager = require('./core/filter');
const keyManager    = require('./core/key_manager');
const SysConf       = require('./config');

const error     = chalk.bold.dim.red;
const warning   = chalk.keyword('orange');
const info      = chalk.bold.dim.green;

program
	.version('0.1.0')
	.usage('清理数据爬虫相关')
	.option('-a,--all', '清理所有爬虫数据（包括过滤器数据）')
	.option('-f,--filter', '清理过滤器数据')
	.option('-s,--schedule', '清理调度中间数据')
	.action(async () => {
		let {all, filter, schedule} = program;

		try {
			filter && await keyManager.clearAllKeys();

			if (schedule || all) {
				await keyManager.clearAllKeys();
				console.log(info(`清理 ${SysConf.NAME} 调度中间数据成功！`));
			}

			if (filter || all) {
				let answer = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'sure',
						message: warning('是否清理所有去重器数据（清除后不可恢复）?'),
						default: false
					}
				]);

				let {sure} = answer;

				if (sure) {
					let fm= await filterManager.get();
					await fm.clear();

					console.log(info(`清理 ${SysConf.NAME} 去重器数据成功！`))
				}
			}
		} catch (err) {
			console.error(error(err))
		} finally {
			process.exit(0);
		}
	})
	.parse(process.argv);