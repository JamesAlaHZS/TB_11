// edit by ala，仅供交流学习 | QQ群：1095180136
function runTask() {
    var pvStr = 'j3VpHkQ';
    var endStr = 'j3VpHkQ';
    var gStr = 'jdw2ebh';
    var taobaoScheme = {
        scheme:"taobao",
        main:"taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.taobao.com",
        start: "taobao://m.tb.cn/h." + pvStr,
        end:"taobao://m.tb.cn/h." + endStr,
        gwc:"taobao://m.tb.cn/h." + gStr,

    }

    var scheme = taobaoScheme

    if (!DB){
        DB = {
            run:0,
            keys:{},
            items:[],
        }
    }
    DB.run = DB.run + 1;
    var taskList = ALLDATA.activity.taskList
    var oneTask = ALLDATA.taskData[taskList[0]];
    var itme = oneTask.task.ckItem;
    var outItme = oneTask.task.outItem ? oneTask.task.outItem : [];
    var ckUrl = oneTask.task.adurl
    var wait = oneTask.task.wait
    var paramObj = oneTask.task.param
    var nowToken = ""
    if (data) {
        var items = []
        var urlItem = []
        var baseUrl = scheme.scheme + ckUrl;

        for (var item of data) {
            if (item.needTimes !== '0') {
                var num = item.needTimes * 1
                var index = item.index

                var deliveryId = item.deliveryId
                var implId = item.implId
                var fromToken = item.fromToken
                nowToken = fromToken;
                if(!DB.keys[deliveryId]){


                    //获取key
                    if (!(outItme.includes(deliveryId))){

                        DB.keys[deliveryId] = true;

                        for (var i = 0; i < num ; i++){
                            var nowImplId = implId
                            var b = nowImplId.split('_');
                            b.pop();
                            nowImplId = b.join('_') + '_' +(index*1 + i)
                            DB.items.push(`${deliveryId} ${nowImplId}`)


                            var addurl = ""
                            var url = baseUrl

                            if (video != '1'){
                                addurl = `&deliveryId=${deliveryId}`
                            }else {
                              
                                    addurl =  `&tl_deliveryId=${deliveryId}` + `&task_sessionId=9647_${deliveryId}_${Date.now() - 1000 + i * 5 }`
                                
                            }

                            url =  baseUrl + addurl

                            urlItem.push({
                                url:url,
                                wait:wait
                            })
                        }



                    }



                }


            }
        }
        var urlD = [ ]
        if (DB.run == 1){

            urlD.push({
                url:scheme.end,
                wait:10
            })

            urlD.push({
                url:scheme.start,
                wait:5
            })

            urlD.push({
                url:scheme.main,
                wait:5
            })
        }

        urlItem.map((v,i) => {
            urlD.push(v)
            if ( i % 1 === 0){
                urlD.push({
                    url:scheme.main,
                    wait:5
                })
            }
        })

        var dd = {
            succes: 'ok',
            data:urlD,
            db:DB,
        };
        if (nowToken){
            dd.token = nowToken;
        }
        if (urlItem.length === 0){
            dd.end = scheme.gwc;

            if (1===1){

                var baseUrl = oneTask.task.ckitemUrl
                itme.map((v,i) => {

                    var str = v;
                    var params = str.split(' ');
                    var url = baseUrl

                    for (var key in paramObj){

                        var paramArr = paramObj[key]
                        var reg = new RegExp(`${key}`,'g')
                        var str = paramArr[Math.floor((Math.random()*paramArr.length))]
                        url = url.replace(reg,str);
                    }
                    //替换参数2
                    params.map((v,i) => {
                        if (v){
                            var num = i+1;
                            var reg = new RegExp(`占位参数${num}`,'g')
                            url = url.replace(reg,v);
                        }
                    });

                    urlD.push({
                        url:scheme.type ? scheme.scheme + encodeURIComponent('https' + url):scheme.scheme + url,
                        wait:wait
                    })
                    urlD.push({
                        url:scheme.main,
                        wait:5
                    })

                })
            }
            urlD.push({
                        url:scheme.end,
                        wait:5
                    })

        }

        return JSON.stringify(dd);
    }else {
        return ;
    }

}
