# 爬虫
### 启动爬虫

    > pm2 start app.js --name 新源关键字
    
### 清除爬虫数据

    > cd source
    > node clean -s
  
### 清除去重器数据
    
    > cd source
    > node clean -f
    
### 清除所有爬虫数据（包括调度数据和去重器数据）

    > cd source
    > node clean -a