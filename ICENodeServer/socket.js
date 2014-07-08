
var ioSock = require('socket.io')
	, redis = require('redis')
	, domain = require('domain')
	, RedisStore = require('socket.io/lib/stores/redis')
	, pubR = redis.createClient()
	, subR = redis.createClient()
	, clientR = redis.createClient()
	, dalayer = require('./dalayer.js');
require('./date.js');
//Sandra start
var SandraStore = redis.createClient();
var SandraStoreForBRPOP = redis.createClient();
//Sandra end

exports.initialize = function (server, cluster) {


    var d = domain.create();
    d.on('error', function (er) {

        try {
            var killtimer = setTimeout(function () {
                process.exit(1);
            }, 10000);
            killtimer.unref();
            //
            //log error detail
            console.error('Error Detail:-', er);

            server.close(function () {
                //console.log('server has been closed');

            });

            cluster.worker.disconnect();

        } catch (er2) {
            console.error('Error sending 500!', er2);
        }
    });
    d.run(function () {

        //io = io.listen(server);
        //var io = ioSock.listen(server, { resource: '/ICEFlashFree/socket.io' });
        var io = ioSock.listen(server);

        // io.server.removeListener('request', io.server.listeners('request')[0]);
        io.set('store', new RedisStore({
            redisPub: pubR
        , redisSub: subR
        , redisClient: clientR
        }));

        io.set('log level', 1);

        //io.set('transports', ['xhr-polling']);
        //io.set("polling duration", 60);

        io.set('transports', [
    	       'websocket'
  	     , 'xhr-polling'
	     , 'flashsocket'
	     , 'htmlfile'
	     , 'jsonp-polling'
  ]);

        /*
        io.set('authorization', function (data, accept) {
        //console.log('http request' + data.headers.cookie);
        if (data.headers.cookie) {
        data.cookie = require('cookie').parse(data.headers.cookie);
        var sessionId = data.cookie['ASP.NET_SessionId'];
        console.log('Asp.net' + sessionId);
        redisClnt.exists(sessionId, function (err, isexist) {
        if (isexist) {
        accept(null, true);
        } else {
        return accept('You do not have permission.', false);
        }
        });
        }

        });*/

        /*io.set('close timeout',30);*/
        io.set('heartbeat timeout', 17);
        io.set('heartbeat interval', 11);
        io.set('origins', '*:*');
        var store = redis.createClient();
        SandraStore.select(2, function (err, res) {
            // you'll want to check that the select was successful here
            if (err) return err;
            // store.set('key', 'string');
        }); // this will be posted to database 1 rather than db 0
        SandraStoreForBRPOP.select(2, function (err, res) {
            // you'll want to check that the select was successful here
            if (err) return err;
            // store.set('key', 'string');
        }); // this will be posted to database 1 rather than db 0
        var redisClnt = redis.createClient();
        var sqlconn = {
            user: 'sa',
            password: 'effective1?',
            server: 'et3ebs6117',
            database: 'eChatDebug'

        }
        var objDalayer = dalayer(sqlconn);

        io.sockets.on('connection', d.bind(function (socket) {
            //throw new Error('something is going wrong!');


            console.log('Connecting.......');
            var sessionInfo;
            var currentChannel;
            var channels = [];
            var reqfrom = '';
            var reqopname = '';
            var reqopguid = '';
            var reqguid = '';
            var reqcustname = '';
            var islogout = 'false';
            var iscusthangup = 'false';
            var timeZoneName = '';
            var IsTimeSlabNeed;
            var TransferTo = '';
            var IsOperatorCS = 'false';
            var IsVisitorCS = 'false';
            var CSStatus = 'false';
            var ChatTypeVal = '';
            var OrgOffset = 0;
            var IsCustomerRejoined = 0;
            var IsSocketDisconnectedManual = 0;

            var sub = redis.createClient();
            var pub = redis.createClient();
            var timeout = null;

            /*var data = require('cookie').parse(socket.handshake.headers.cookie);
            var curSessionId = data['ASP.NET_SessionId'];
            redisClnt.rpush('CurrentSessions', curSessionId);*/

            // console.log('current socket id:-' + socket.id);


            function heartbeatReceived() {

                clearTimeout(timeout);
                timeout = setTimeout(function () {
                    //disconnected
                    IsCustomerRejoined = 0;
                    DisconnectSocket();
                }, 17 * 1000)
            }

            socket.on('heartbeat-manual', d.bind(function (heartbeatReceivedFlag) {
                IsSocketDisconnectedManual = 1;
                heartbeatReceived();

            }));

            //this event will fire from customer to check operator current status(CUSTOMER EVENT)
            socket.on('oprCurrentStatus', d.bind(function (operatorId) {
                console.log('Message from oprCurrentStatus:-' + operatorId);
                objDalayer.oprCurrentStatus(operatorId, d.bind(function (err, currentStatus) {
                    if (err) { throw err; };
                    console.log('OPERATOE CURRENT STATUS:-' + currentStatus + 'FOR GUID ' + reqguid);

                    var now = new Date();
                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                    if (parseInt(currentStatus) == 0) {
                        //Rename redis GUID instead of Delete
                        store.del(reqguid);
                        redisClnt.lrem(operatorId, -1, reqguid);
                        //this code commented on 5/2/2014
                        /*redisClnt.del('OperatorRedisLastRec' + reqguid);
                        redisClnt.del('CustomerRedisLastRec' + reqguid);*/
                        redisClnt.del('IsCustomerConnect' + reqguid);
                        redisClnt.del('CustomerMsgs' + reqguid);
                        redisClnt.del('OperatorMsgs' + reqguid);
                        redisClnt.del('IsEscalated' + reqguid);
                        redisClnt.del('SupervisorRedisLastRec' + reqguid);

                    }

                    socket.send(JSON.stringify({ action: 'OperatorCurrentStatus', oprCurrentStatus: currentStatus }));

                }));
            }));
            //this event will use to store the operator id for customer to retrieve later in customer close chat.(CUSTOMER EVENT)
            socket.on('storeOprid', d.bind(function (operatorId) {
                socket.set('operatorConnectedToChat', operatorId, d.bind(function (err) {
                    if (err) { throw err };
                    //console.log('Operator set for chat');
                }));
            }));

            //this function will use for updated the operator activity status after 1 minute operator not reconnected

            var operatorTimeout = null;

            function operatorTimeoutForReconnect() {

                clearTimeout(operatorTimeout);
                operatorTimeout = setTimeout(function () {

                    redisClnt.get(sessionInfo.OperatorID + 'Timeout', d.bind(function (err, IsTimeout) {
                        if (IsTimeout == 1) {
                            //console.log('Operator refresh')	;
                            var ChatShouldEnd = [];
                            redisClnt.lrange(sessionInfo.OperatorID, 0, -1, d.bind(function (err, replies) {
                                if (err) { throw err };
                                var clientLength = replies.length;
                                // console.log('Redis list length on disconnect:----' + clientLength);
                                if (clientLength == 0) {
                                    objDalayer.disconnectOperator(parseInt(sessionInfo.OperatorID), 20, d.bind(function (err) {
                                        if (err) { throw err; };
                                        //console.log('update user with status 20');
                                    }));
                                }
                                else {
                                    var i = 0;
                                    replies.forEach(function (channel) {

                                        //console.log('Channel Name:-' + channel);
                                        //console.log('Operator disconnect!!!!!!!!!!!!');
                                        var now = new Date();
                                        var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                                        var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                                        ChatShouldEnd.push(JSON.stringify({ action: 'OperatorCloseConsole', sender: reqopname, opid: sessionInfo.OperatorID, msg: 'Chat has been closed by Operator.', guid: channel, istransfer: 'false', localtime: sdate, servertime: udate, priority: '1', from: 'System' }));
                                        //var reply = JSON.stringify({ action: 'OperatorCloseConsole', sender: reqopname, opid: sessionInfo.OperatorID, msg: 'Chat has been closed by Operator.', guid: channel, istransfer: 'false', localtime: sdate, servertime: udate, priority: '1' });
                                        objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 80, channel, d.bind(function (err) {
                                            if (err) { throw err; };
                                            i = i + 1;
                                            //console.log('Loop length:------' + i);

                                            //check last entry in chat list.
                                            if (i >= clientLength) {
                                                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 60, channel, d.bind(function (err) {
                                                    if (err) { throw err; };
                                                    objDalayer.disconnectOperator(parseInt(sessionInfo.OperatorID), 20, d.bind(function (err) {
                                                        if (err) { throw err; };
                                                        //console.log('update user with status 20');
                                                        for (var j = ChatShouldEnd.length - 1; j >= 0; j--) (function (j) {
                                                            var currentRow = ChatShouldEnd.splice(j, 1);
                                                            var currentRowJSON = JSON.parse(currentRow);
                                                            //send message to operator added on 5/1/2013
                                                            socket.send(currentRow);
                                                            /*start push and pub added on 5/1/2013*/
                                                            store.rpush(currentRowJSON.guid, currentRow, d.bind(function () {
                                                                store.rpush('CustomerMsgs' + currentRowJSON.guid, currentRow, d.bind(function () {

                                                                    pub.publish(currentRowJSON.guid, currentRow, function () {
                                                                        //console.log('Current Row GUID:-' + currentRowJSON.guid);
                                                                        sub.unsubscribe(currentRowJSON.guid, d.bind(function () {
                                                                            //remove listener
                                                                            sub.removeListener('message', Asynccallback);
                                                                        }));
                                                                    });

                                                                }));

                                                            }));
                                                            /*end push and pub*/

                                                        })(j);

                                                    }));



                                                }));
                                            }

                                        }));

                                        store.lrange(channel, 0, -1, d.bind(function (error, items) {
                                            if (error) { throw error }
                                            objDalayer.saveChatHistory(items, channel, timeZoneName, d.bind(function (err) {
                                                if (err) { throw err; };
                                            }));
                                        }));

                                        objDalayer.cleanCallQueue(channel, d.bind(function (err) {
                                            if (err) { throw err; };
                                        }));



                                    });
                                }
                            }));
                        }
                        else {
                            redisClnt.set(sessionInfo.OperatorID + 'Timeout', 1);
                        }
                    }));

                }, 60 * 1000)
            }

            //this function initiated when server socket's disconnect event fire/heartbeat timeout for socket.
            function DisconnectSocket() {
                socket.get('Whosend', d.bind(function (err, reqfrom) {
                    //console.log('Disconnect event fired!!!!!!!!!!!!!!!');
                    //console.log("socket disconnect for:-" + reqfrom);
                    if (reqfrom == 'Operator') {
                        if (islogout == 'false') {
                            operatorTimeoutForReconnect();
                        }
                    }
                    else if (reqfrom == 'Visitor') {
                        if (iscusthangup == 'false') {
                            //console.log('Close by Customer!!!!!!');
                            //IsCustomerRejoined (use for IE),IsSocketDisconnectedManual(use for other)
                            if (IsCustomerRejoined == 0 || IsSocketDisconnectedManual == 0) {
                                //console.log('Message from visitor disconnect:-' + reqguid);
                                //redisClnt.get('CustomerRedisLastRec' + reqguid, d.bind(function (err, reply) {
                                redisClnt.get('IsCustomerConnect' + reqguid, d.bind(function (err, reply) {
                                    if (err) { throw err; };
                                    if (reply) {
                                        //console.log('Visitor IsCustomerRejoined :-' + IsCustomerRejoined);
                                        //console.log('Visitor IsSocketDisconnectedManual :-' + IsSocketDisconnectedManual);
                                        IsCustomerRejoined = 1;

                                        var now = new Date();
                                        var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                                        var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                                        var msg1 = "<div><font color='#FF0000'>" + reqcustname + " has been disconnected. </font></div>";
                                        var reply = JSON.stringify({ action: 'CustomerDisconnected', custname: reqcustname, msg: msg1, guid: reqguid, localtime: sdate, servertime: udate, priority: '1', from: reqfrom });
                                        //send message to customer added on 5/1/2014
                                        socket.send(JSON.stringify({ action: 'CustomerDisconnected', sender: reqcustname, msg: msg1, guid: reqguid, localtime: sdate, servertime: udate, priority: '1', from: 'System' }));
                                        /*start push and pub added on 5/1/2014 */
                                        store.rpush(reqguid, JSON.stringify({ action: 'CustomerDisconnected', sender: reqcustname, msg: msg1, guid: reqguid, localtime: sdate, servertime: udate, priority: '1', from: 'System' }), function () {
                                            store.rpush('OperatorMsgs' + reqguid, JSON.stringify({ action: 'CustomerDisconnected', sender: reqcustname, msg: msg1, guid: reqguid, localtime: sdate, servertime: udate, priority: '1', from: 'System' }), function () {

                                                pub.publish(reqguid, reply);
                                                sub.unsubscribe(reqguid, d.bind(function () {
                                                    //console.log('Customer Unsubscribing from ' + reqguid + ' channel.');
                                                    //write down a logic to clear a redis list and variables.
                                                    socket.get('operatorConnectedToChat', d.bind(function (err, operatorId) {
                                                        if (operatorId != null) {
                                                            //console.log('Customer disconnected agentid:-' + operatorId);
                                                            if (err) { throw err; };

                                                            objDalayer.oprCurrentStatus(operatorId, d.bind(function (err, currentStatus) {
                                                                if (err) { throw err; };
                                                                //console.log('Operator current status:-' + currentStatus);
                                                                if (parseInt(currentStatus) == 0) {
                                                                    //Rename redis GUID instead of Delete
                                                                    store.del(reqguid);
                                                                    var now = new Date();
                                                                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy-HH:mm:ss");
                                                                    //console.log(reqguid + '_' + udate);
                                                                    //store.rename(reqguid, reqguid + '_' + udate);
                                                                    redisClnt.lrem(operatorId, -1, reqguid);
                                                                    //this code commented on 5/2/2014
                                                                    /*redisClnt.del('OperatorRedisLastRec' + reqguid);
                                                                    redisClnt.del('CustomerRedisLastRec' + reqguid);*/
                                                                    redisClnt.del('IsCustomerConnect' + reqguid);
                                                                    redisClnt.del('CustomerMsgs' + reqguid);
                                                                    redisClnt.del('OperatorMsgs' + reqguid);
                                                                    redisClnt.del('IsEscalated' + reqguid);
                                                                    redisClnt.del('SupervisorRedisLastRec' + reqguid);

                                                                }
                                                                //socket.send(JSON.stringify({ action: 'OperatorCurrentStatus', oprCurrentStatus: currentStatus }));

                                                            }));
                                                        }
                                                        //remove listener
                                                        sub.removeListener('message', Asynccallback);
                                                    }));
                                                }));

                                            });

                                        });
                                        /*end push and pub*/
                                    }
                                }));


                            }
                        }
                    }
                }));
            }

            //On Customer reconnect(CUSTOMER EVENT)
            socket.on('customerRejoin', d.bind(function (tockenId, operatorId, customerName, offset) {

                // redisClnt.get('CustomerRedisLastRec' + tockenId, d.bind(function (err, reply) {
                redisClnt.get('IsCustomerConnect' + tockenId, d.bind(function (err, reply) {
                    if (err) { throw err; };
                    if (reply) {

                        OrgOffset = offset;
                        //console.log('Message from customerRejoin:-' + operatorId);
                        socket.set('operatorConnectedToChat', operatorId, d.bind(function (err) {
                            if (err) { throw err };
                        }));
                        IsCustomerRejoined = 1;
                        reqguid = tockenId;
                        reqcustname = customerName;
                        var requestFrom = 'Visitor'
                        socket.set('Whosend', requestFrom, d.bind(function () {
                            reqfrom = requestFrom;
                        }));
                        sub.subscribe(tockenId);
                        var now = new Date();
                        var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                        var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                        var reply = JSON.stringify({ action: 'CustomerRejoin', sender: '', msg: '', guid: tockenId, localtime: '', servertime: sdate, priority: '1', from: 'System' });
                        //send message to customer added on 5/1/2014
                        socket.send(JSON.stringify({ action: 'CustomerRejoin', sender: '', msg: '', guid: tockenId, localtime: sdate, servertime: udate, priority: '1', from: 'System' }));
                        /*start push and pub added on 5/1/2014*/
                        store.rpush(tockenId, JSON.stringify({ action: 'CustomerRejoin', sender: '', msg: '', guid: tockenId, localtime: sdate, servertime: udate, priority: '1', from: 'System' }), function () {
                            store.rpush('OperatorMsgs' + tockenId, JSON.stringify({ action: 'CustomerRejoin', sender: '', msg: '', guid: tockenId, localtime: sdate, servertime: udate, priority: '1', from: 'System' }), function () {
                                pub.publish(tockenId, reply);
                            });


                        });

                        // var reply = JSON.stringify({ action: 'CustomerRejoin', sender: '', msg: '', guid: tockenId, localtime: '', servertime: sdate, priority: '1', from: 'System' });
                        // pub.publish(tockenId, reply);
                    }
                    else {
                        //console.log('visitor has left to chat.');
                        socket.send(JSON.stringify({ action: 'CustomerChatDisconnected' }));
                        sub.unsubscribe(tockenId, d.bind(function () {
                            //remove listener
                            sub.removeListener('message', Asynccallback);
                        }));

                    }
                }));

            }));

            //Afte operator reconnected and check the visitor/customer available.
            socket.on('darshanTest', d.bind(function (data) {
                socket.send(JSON.stringify({ action: 'darshan', msg: 'This is test msg' }));
            }));
            socket.on('CheckCustomerConnected', d.bind(function (guid) {
                //redisClnt.get('CustomerRedisLastRec' + guid, d.bind(function (err, reply) {
                redisClnt.get('IsCustomerConnect' + guid, d.bind(function (err, reply) {
                    if (err) { throw err; };
                    if (!reply) {
                        //console.log('Customer not available:-' + guid);
                        socket.emit('ShowCustomerConnectedMsg', 0, guid);
                    }
                }));
            }));

            //on operator rejoin(OPERATOR EVENT)

            socket.on('operatorReConnected', d.bind(function (tockenId, offset) {
                //console.log('Operator Reconnect TokenId:-' + tockenId);

                redisClnt.get(tockenId, d.bind(function (err, reply) {
                    if (err) { throw err; };
                    OrgOffset = offset;
                    socket.send(JSON.stringify({ action: 'operatorReconnected' }));
                    sessionInfo = JSON.parse(reply);
                    //console.log('Role:-' + sessionInfo.Role);
                    //this value use on operator disconnected to check operator reconnected.
                    redisClnt.set(sessionInfo.OperatorID + 'Timeout', 0);

                    var requestFrom = 'Operator';
                    socket.set('Whosend', requestFrom, d.bind(function () {
                        reqfrom = requestFrom;
                    }));
                    //console.log('Message from OperatorReconnect:-' + sessionInfo.OperatorID);
                    //update user activity status to match entry 20-10 pair,
                    objDalayer.oprCurrentStatus(sessionInfo.OperatorID, d.bind(function (err, currentStatus) {
                        if (err) { throw err; };
                        //console.log('Current Status:-' + currentStatus);
                        if (parseInt(currentStatus) == 0) {
                            var address = socket.handshake.address;
                            IP = address.address;

                            objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 10, '', d.bind(function (err) {
                                if (err) { throw err; };


                            }));
                            //update user status
                            objDalayer.updateUserStatus(parseInt(sessionInfo.OperatorID), 10, IP, 0, d.bind(function (err) {
                                if (err) { throw err; };


                            }));




                        }
                    }));

                    redisClnt.lrange(sessionInfo.OperatorID, 0, -1, d.bind(function (err, replies) {
                        if (err) { throw err };
                        replies.forEach(function (reply) {
                            //resubscribe to channels
                            //console.log('Reply:-' + reply);
                            sub.subscribe(reply);
                            var now = new Date();
                            var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                            var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                            var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                            var sendReply = JSON.stringify({ action: 'operatorReconnected', sender: '', msg: '', guid: reply, localtime: sdate, servertime: udate, priority: '1', from: 'System' });
                            /*store.rpush(reply, JSON.stringify({ action: 'operatorReconnected', sender: '', msg: '', guid: reply, localtime: sdate, servertime: udate, priority: '1', from: 'System' }), function () {
                            pub.publish(reply, sendReply);

                            });*/
                            pub.publish(reply, JSON.stringify({ action: 'OperatorReJoin', guid: reply }));
                        });
                    }));
                    //get operator timezone
                    objDalayer.getOperatorTimeZone(parseInt(sessionInfo.OperatorID), d.bind(function (err, oprTimezoneName, oprIsTimeSlabNeed) {
                        if (err) { throw err; };
                        timeZoneName = oprTimezoneName;
                        IsTimeSlabNeed = oprIsTimeSlabNeed;
                    }));
                    sub.subscribe('Operator' + sessionInfo.OperatorID);
                }));
            }));
            //On Operator Login (OPERATOR EVENT)
            socket.on('join', d.bind(function (tockenId) {

                redisClnt.get(tockenId, d.bind(function (err, reply) {
                    if (err) { throw err; };
                    sessionInfo = JSON.parse(reply);
                    //console.log('Role:-' + sessionInfo.Role);
                    //redisClnt.del(sessionInfo.OperatorID);
                    //socket.send(JSON.stringify({ action: 'ConnectNow', username: sessionInfo.UserName }));
                    //this value use to check operator timeout when operator disconnected due to network or forcefully close the console
                    //redisClnt.set(sessionInfo.OperatorID + 'Timeout', 1);
                    socket.send(JSON.stringify({ action: 'OperatorConnecting' }));
                    var secs = 0;
                    var myVar = setInterval(function () {
                        secs++;
                        if (secs >= 80) {
                            objDalayer.disconnectOperator(parseInt(sessionInfo.OperatorID), 20, d.bind(function (err) {
                                if (err) { throw err; };
                                console.log('Role:-' + sessionInfo.Role);
                                redisClnt.del(sessionInfo.OperatorID);
                                socket.send(JSON.stringify({ action: 'ConnectNow', username: sessionInfo.UserName }));
                                //this value use to check operator timeout when operator disconnected due to network or forcefully close the console
                                redisClnt.set(sessionInfo.OperatorID + 'Timeout', 1);
                                clearInterval(myVar);
                            }));
                        }
                        else {
                            objDalayer.getLastOperatorActivity(sessionInfo.OperatorID, d.bind(function (err, currentStatus) {
                                if (err) { throw err; };
                                if (currentStatus == 20) {
                                    console.log('Role:-' + sessionInfo.Role);
                                    redisClnt.del(sessionInfo.OperatorID);
                                    socket.send(JSON.stringify({ action: 'ConnectNow', username: sessionInfo.UserName }));
                                    //this value use to check operator timeout when operator disconnected due to network or forcefully close the console
                                    redisClnt.set(sessionInfo.OperatorID + 'Timeout', 1);
                                    clearInterval(myVar);
                                }
                            }));
                        }
                    }, 1000);
                }));
            }));
            // (OPERATOR EVENT)
            socket.on('OperatorConnect', d.bind(function (IP) {
                //console.log('Operator connect!!!!!!!!!!!!');
                var address = socket.handshake.address;
                IP = address.address;

                var requestFrom = 'Operator';
                socket.set('Whosend', requestFrom, d.bind(function () {
                    reqfrom = requestFrom;
                }));
                //update user activity
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 10, '', d.bind(function (err) {
                    if (err) { throw err; };
                }));
                //update user status
                objDalayer.updateUserStatus(parseInt(sessionInfo.OperatorID), 10, IP, 0, d.bind(function (err) {
                    if (err) { throw err; };
                }));
                //get operator timezone
                objDalayer.getOperatorTimeZone(parseInt(sessionInfo.OperatorID), d.bind(function (err, oprTimezoneName, oprIsTimeSlabNeed) {
                    if (err) { throw err; };
                    timeZoneName = oprTimezoneName;
                    IsTimeSlabNeed = oprIsTimeSlabNeed;
                }));
                sub.subscribe('Operator' + sessionInfo.OperatorID);
            }));
            //On Operator Logout (OPERATOR EVENT)
            socket.on('OperatorDisconnect', d.bind(function () {
                redisClnt.del(sessionInfo.OperatorID + 'Timeout');
                objDalayer.disconnectOperator(parseInt(sessionInfo.OperatorID), 20, d.bind(function (err) {
                    if (err) { throw err; };
                }));
                islogout = 'true';
            }));
            //(OPERATOR EVENT)
            socket.on('getCurrentCustomerTimeStampStatus', d.bind(function () {
                socket.send(JSON.stringify({ action: 'CurrentTimeStampStatus_CallBack', guid: reqopguid, isEnable: IsTimeSlabNeed, IsNewConnection: 'false' }));
            }));
            //On new chat initiate (CUSTOMER EVENT)
            socket.on('NewChat', d.bind(function (VisitorName, soName, chatType) {
                store.del(soName, d.bind(function () {

                    store.del('CustomerMsgs' + soName, d.bind(function () {
                        store.del('OperatorMsgs' + soName, d.bind(function () {

                            ChatTypeVal = chatType;
                            //Sandra start1
                            //  store.rpush('list1', JSON.stringify({ action: soName }));
                            //  store.rpush('list1', JSON.stringify({ GuID: soName, action: 'PostChatSurvey' }));
                            //Sandra end1
                            //find the available operator for given skill(if operator not available then fire event OperatorUnavailable)
                            //console.log('NewChat soName:-' + soName);
                            objDalayer.assignOperator(soName, d.bind(function (err, returnValue) {
                                if (err) { throw err; };
                                if (returnValue == 0) {
                                    socket.send(JSON.stringify({ action: 'OperatorUnavailable' }));
                                } else {
                                    //reqfrom = 'Visitor';
                                    var requestFrom = 'Visitor'
                                    socket.set('Whosend', requestFrom, d.bind(function () {
                                        reqfrom = requestFrom;
                                    }));
                                    reqguid = soName;
                                    reqcustname = VisitorName;
                                    sub.subscribe(soName);
                                    //store record count from redis for each chat
                                    //(commented on 5/2/2014) redisClnt.set('CustomerRedisLastRec' + soName, 0);

                                    //this flag will use to identify is customer connected added on 5/2/2014
                                    redisClnt.set('IsCustomerConnect' + soName, 1);

                                    redisClnt.set(soName + 'Timeout', 1);
                                    objDalayer.getOperatorNameById(parseInt(returnValue), d.bind(function (err, userFName) {
                                        if (err) { throw err };
                                        console.log('NewChat username:-' + userFName);
                                        pub.publish('Operator' + returnValue, JSON.stringify({ action: 'NewConnection', guid: soName, visitor: VisitorName, operator: userFName, istransfer: 'false' }));
                                        SandraStore.rpush('I2S', JSON.stringify({ action: 'NewChat', GuID: soName, VisitorName: VisitorName, OperatorID: returnValue }));
                                    }));
                                }
                            }));

                        }));
                    }));


                }));

            }));
            //On operator connected to visitor(OPERATOR EVENT)
            socket.on('OperatorChatConnect', d.bind(function (OperatorName, guid, offset) {
                OrgOffset = offset;
                redisClnt.rpush(sessionInfo.OperatorID, guid, d.bind(function () {
                    //store record count from redis per chat for operator
                    //console.log('Insert GUID to Redis List');
                    //this code commented on 5/2/2014
                    //redisClnt.set('OperatorRedisLastRec' + guid, 0);
                    //redisClnt.set('IsEscalated' + guid,0);
                    sub.subscribe(guid);
                    reqopname = OperatorName;
                    reqopguid = guid;

                    objDalayer.acceptCall(guid, parseInt(sessionInfo.OperatorID), d.bind(function (err) {
                        if (err) { throw err; };
                    }));

                    redisClnt.llen(sessionInfo.OperatorID, d.bind(function (err, len) {
                        //console.log('Chat length:-' + len + ' Operator' + sessionInfo.OperatorID);
                        if (len == 1) {
                            //console.log('Chat length:-' + len);
                            objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 50, guid, d.bind(function (err) {
                                if (err) { throw err; };
                                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 70, guid, d.bind(function (err) {
                                    if (err) { throw err; };
                                }));
                            }));
                        } else {
                            objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 70, guid, d.bind(function (err) {
                                if (err) { throw err; };

                            }));
                        }
                    }));



                    var now = new Date();
                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");


                    //send msg to socket(operator) added on 5/1/2014
                    socket.send(JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }));

                    /*start push and pub added on 5/1/2014*/
                    store.rpush(guid, JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }), d.bind(function () {
                        //this list use for customer
                        store.rpush('CustomerMsgs' + guid, JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }), d.bind(function () {
                            pub.publish(guid, JSON.stringify({ action: 'OperatorChatConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID }), function () {

                                objDalayer.getGreetingMsg(guid, d.bind(function (err, greetingMsg) {
                                    if (err) { throw err; };
                                    var now = new Date();
                                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                                    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                                    var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                                    greeting = greetingMsg;
                                    if (greeting == undefined || greeting == 'null' || greeting == '') {
                                        greeting = "Welcome to the site...";
                                    }
                                    //send msg to operator added on 5/1/2014
                                    socket.send(JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }));
                                    /*start push and pub added on 5/1/2014*/
                                    store.rpush(guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }), d.bind(function () {
                                        store.rpush('CustomerMsgs' + guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }), d.bind(function () {
                                            pub.publish(guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, opname: OperatorName, msg: greeting, localtime: sdate, offset: OrgOffset }));
                                            SandraStore.rpush('I2S', JSON.stringify({ action: 'GreetingMessage', GuID: guid }));
                                        }));

                                    }));
                                    /*end pub and pub*/
                                }));


                            });

                        }));

                    }));
                    /*end push and pub*/

                }));


                var greeting = '';




            }));
            //after Operator connected to chat send greeting message(OPERATOR EVENT)
            socket.on('sendGreetingMsg', d.bind(function (OperatorName, guid) {

                objDalayer.getGreetingMsg(guid, d.bind(function (err, greetingMsg) {
                    if (err) { throw err; };
                    var now = new Date();
                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                    greeting = greetingMsg;
                    if (greeting == undefined || greeting == 'null' || greeting == '') {
                        greeting = "Welcome to the site...";
                    }
                    //send msg to operator added on 5/1/2014
                    socket.send(JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }));
                    /*start push and pub added on 5/1/2014*/
                    store.rpush(guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }), d.bind(function () {
                        store.rpush('CustomerMsgs' + guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, msg: greeting, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, offset: OrgOffset, from: 'System' }), d.bind(function () {
                            pub.publish(guid, JSON.stringify({ action: 'GreetingMessage', guid: guid, opname: OperatorName, msg: greeting, localtime: sdate, offset: OrgOffset }));

                        }));

                    }));
                    /*end pub and pub*/
                }));
            }));
            //(CUSTOMER EVENT)
            socket.on('SetVisitorOffset', d.bind(function (offset) {
                OrgOffset = offset;
            }));

            socket.on('disconnectMe', d.bind(function () {
                console.log('DisconnectedMe');
            }));


            socket.on("disconnect", d.bind(function () {
                //console.log('IsSocketDisconnectedManual:-' + IsSocketDisconnectedManual);
                if (IsSocketDisconnectedManual == 0) {
                    console.log('call disconnect');
                    DisconnectSocket();
                }





            }));
            //Set flag on Operator's first reponse to visitor (CUSTOMER EVENT)
            socket.on('OperatorResponseToVisitor', d.bind(function () {
                IsOperatorCS = 'true';
            }));


            /*New event for customer chat message*/

            socket.on('CustomerChat', d.bind(function (data) {
                var msg = JSON.parse(data);
                //console.log('CHAT MESSAGE FOR:-' + msg.guid);
                //Sandra start		

                SandraStore.rpush('I2S', JSON.stringify({ Msg: msg.msg, GuID: msg.guid, action: 'ChatMessage', Sender: msg.from, Type: 'ICE' }));

                //Sandra end
                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                var reply = JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                //send message to customer added on 5/1/2014
                socket.send(JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }));
                /*start push and pub*/
                store.rpush(msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), function () {
                    store.rpush('OperatorMsgs' + msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), d.bind(function () {
                        pub.publish(msg.guid, reply);
                    }));

                });
                /*end push and pub*/
                socket.get('Whosend', function (err, reqfrom) {
                    if (reqfrom == 'Operator') {
                        if (IsOperatorCS == 'false') {
                            IsOperatorCS = 'true';
                            //commneted by vishal No clue why this is used
                            pub.publish(msg.guid, JSON.stringify({ action: 'OperatorResponded' }));
                        }
                    }
                    else if (reqfrom == 'Visitor') {
                        if (IsVisitorCS == 'false') {
                            IsVisitorCS = 'true';
                        }
                    }
                });


                if (IsOperatorCS == 'true' && IsVisitorCS == 'true' && CSStatus == 'false') {
                    CSStatus = 'true';
                    socket.get('Whosend', function (err, reqfrom) {
                        if (reqfrom == 'Visitor') {
                            //update conversation status
                            objDalayer.updateConversationStatus(msg.guid, ChatTypeVal, d.bind(function (err) {
                                if (err) { throw err; };
                            }));
                        }
                    });

                }

            }));

            //send message from operator/visitor(OPERATOR EVENT)
            socket.on('OperatoChat', d.bind(function (data) {
                var msg = JSON.parse(data);
                //console.log('CHAT MESSAGE FOR:-' + msg.guid);
                //Sandra start		

                SandraStore.rpush('I2S', JSON.stringify({ Msg: msg.msg, GuID: msg.guid, action: 'ChatMessage', Sender: msg.from, Type: 'ICE' }));

                //Sandra end
                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                var reply = JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                //send message to operator added on 5/1/2014
                socket.send(JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }));
                /*start push and pub added on 5/1/2014*/
                store.rpush(msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), function () {
                    store.rpush('CustomerMsgs' + msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), d.bind(function () {
                        pub.publish(msg.guid, reply);
                    }));

                });
                /*end push and pub*/
                socket.get('Whosend', function (err, reqfrom) {
                    if (reqfrom == 'Operator') {
                        if (IsOperatorCS == 'false') {
                            IsOperatorCS = 'true';
                            //commneted by vishal No clue why this is used
                            pub.publish(msg.guid, JSON.stringify({ action: 'OperatorResponded' }));
                        }
                    }
                    else if (reqfrom == 'Visitor') {
                        if (IsVisitorCS == 'false') {
                            IsVisitorCS = 'true';
                        }
                    }
                });


                if (IsOperatorCS == 'true' && IsVisitorCS == 'true' && CSStatus == 'false') {
                    CSStatus = 'true';
                    socket.get('Whosend', function (err, reqfrom) {
                        if (reqfrom == 'Visitor') {
                            //update conversation status
                            objDalayer.updateConversationStatus(msg.guid, ChatTypeVal, d.bind(function (err) {
                                if (err) { throw err; };
                            }));
                        }
                    });

                }
            }));

            //Push URL (OPERATOR EVENT)
            socket.on('PushURL', d.bind(function (data) {
                var msg = JSON.parse(data);
                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                var reply = JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                //send message to operator
                socket.send(JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }));
                /*start push and pub added on 5/1/2014*/
                store.rpush(msg.guid, JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), function () {
                    store.rpush('CustomerMsgs' + msg.guid, JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), function () {
                        pub.publish(msg.guid, reply);
                    });

                });
                /*end push and pub*/
            }));


            //TransferAccept_Source(OPERATOR EVENT)
            socket.on('TransferAccept_Source', d.bind(function (data) {
                var msg = JSON.parse(data);
                TransferTo = msg.transferringoperator;
                //update user activity
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 75, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

            }));

            //TransferReject_Source (OPERATOR EVENT)
            socket.on('TransferReject_Source', d.bind(function (data) {
                var msg = JSON.parse(data);
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 76, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

            }));
            //TransferAccept(OPERATOR EVENT)
            socket.on('TransferAccept', d.bind(function (data) {
                var msg = JSON.parse(data);

                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 73, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                var reply = JSON.stringify({ action: 'AcceptTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator' + sessionInfo.OperatorID, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                pub.publish(msg.transferringoperator, reply);
            }));
            //TransferReject (OPERATOR EVENT)
            socket.on('TransferReject', d.bind(function (data) {
                var msg = JSON.parse(data);
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 74, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                var reply = JSON.stringify({ action: 'RejectTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator' + sessionInfo.OperatorID, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                pub.publish(msg.transferringoperator, reply);
            }));
            //OperatorTransfer (OPERATOR EVENT)
            socket.on('OperatorTransfer', d.bind(function (data) {
                var msg = JSON.parse(data);
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 72, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                var reply = JSON.stringify({ action: 'ConfirmTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator' + sessionInfo.OperatorID, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                pub.publish(msg.transferringoperator, reply);
            }));
            //Disconnect chat on transfer(OPERATOR EVENT)
            socket.on('TransferdisconnectUser', d.bind(function (data) {
                var msg = JSON.parse(data);
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 81, msg.guid, d.bind(function (err) {
                    if (err) { throw err; };

                }));

                /*if (channels.length == 1) {
                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 60, msg.guid, d.bind(function (err) {
                if (err) { throw err; };

                }));
                }
                channels.splice(channels.indexOf(msg.guid), 1);
                sub.unsubscribe(msg.guid, function () {
                //console.log('Operator Unsubscribing from ' + msg.guid + ' channel.');
                sub.removeListener('message', callback);
                });*/
                sub.unsubscribe(msg.guid, d.bind(function () {
                    redisClnt.lrem(sessionInfo.OperatorID, -1, msg.guid, d.bind(function (err) {
                        redisClnt.llen(sessionInfo.OperatorID, d.bind(function (err, len) {
                            if (len == 0) {
                                if (err) { throw err; };
                                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 60, msg.guid, d.bind(function (err) {
                                    if (err) { throw err; };

                                }));
                            }
                        }));
                    }));
                    sub.removeListener('message', callback);
                }));
                socket.send(JSON.stringify({ action: 'disconnectChatCallback', guid: msg.guid }));
                //Transfer connection to new operator
                //console.log('TransferTo:' + TransferTo);
                //TransferCall(parseInt(sessionInfo.OperatorID), parseInt(TransferTo.substring(8)), msg.guid);
                objDalayer.transferCall(parseInt(sessionInfo.OperatorID), parseInt(TransferTo.substring(8)), msg.guid, d.bind(function (err) {
                    if (err) { throw err; };
                }));

                objDalayer.getOperatorNameById(parseInt(TransferTo.substring(8)), function (err, forname) {
                    if (err) { throw err; };
                    objDalayer.getVisitorName(msg.guid, d.bind(function (err, visitorname) {
                        if (err) { throw err; };
                        //console.log('Visitor Name:-' + visitorname);
                        pub.publish(TransferTo, JSON.stringify({ action: 'TransferConnection', guid: msg.guid, visitor: visitorname, operator: forname, istransfer: 'true' }));
                    }));
                })

            }));
            //Connect Transfereed chat to new operator(OPERATOR EVENT)
            socket.on('TransferChatConnect', d.bind(function (OperatorName, guid, offset) {
                OrgOffset = offset;
                //console.log('Offset:' + OrgOffset);
                redisClnt.rpush(sessionInfo.OperatorID, guid, d.bind(function () {
                    sub.subscribe(guid);
                    //channels.push(guid);
                    reqopname = OperatorName;
                    objDalayer.acceptCall(guid, parseInt(sessionInfo.OperatorID), d.bind(function (err) {
                        if (err) { throw err; };
                    }));

                    /*if (channels.length == 1) {
                    objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 50, guid, d.bind(function (err) {
                    if (err) { throw err; };
                    }));
                    }

                    objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 71, guid, d.bind(function (err) {
                    if (err) { throw err; };

                    }));*/

                    redisClnt.llen(sessionInfo.OperatorID, d.bind(function (err, len) {
                        //console.log('Chat length:-' + len + ' Operator' + sessionInfo.OperatorID);
                        if (len == 1) {
                            console.log('Chat length:-' + len);
                            objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 50, guid, d.bind(function (err) {
                                if (err) { throw err; };
                                objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 71, guid, d.bind(function (err) {
                                    if (err) { throw err; };
                                }));
                            }));
                        } else {
                            objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 71, guid, d.bind(function (err) {
                                if (err) { throw err; };

                            }));
                        }
                    }));
                }));
                var ChatHistory = '';
                store.lrange(guid, 0, -1, function (error, items) {
                    items.forEach(function (item) {
                        var data = JSON.parse(item);
                        if (data.action == 'PrivateMessage') {
                            ChatHistory += "<span> <u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#FF0000'>" + data.msg + "</font></span></br>";
                        }
                        else if (data.action == 'OperatorConnect') {
                            ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<font color=\"#003399\">" + data.msg + "</font></span></br>";
                        }
                        else if (data.action == 'PushURL') {
                            ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#003399'>" + data.msg + "</font></span></br>";
                        }
                        else if (data.action == 'Message') {
                            ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#003399'>" + data.msg + "</font></span></br>";
                        }
                    })
                    //console.log('Chat History:' + ChatHistory);
                    var reply = JSON.stringify({ action: 'TransferChat', sender: '', msg: ChatHistory, guid: guid });
                    socket.send(reply);
                });

                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");


                //send message to operator added on 5/1/2014
                socket.send(JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }));
                /*start push and pub added on 5/1/2014*/
                store.rpush(guid, JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }), function () {
                    store.rpush('CustomerMsgs' + guid, JSON.stringify({ action: 'OperatorConnect', msg: OperatorName + " joined the conversation", guid: guid, sender: OperatorName, opid: sessionInfo.OperatorID, localtime: sdate, servertime: udate, from: 'System' }), function () {
                        pub.publish(guid, JSON.stringify({ action: 'OperatorChatConnect', msg: OperatorName + " joined the conversation", guid: guid, opname: OperatorName, opid: sessionInfo.OperatorID }));
                    });

                });
                /*end push and pub*/
            }));



            //On operator hangup(OPERATOR EVENT)
            socket.on('OperatorHangUp', d.bind(function (data) {
                var msg = JSON.parse(data);
                //sandra start
                SandraStore.rpush('I2S', JSON.stringify({ action: 'EndChat', GuID: msg.guid, OperatorID: sessionInfo.OperatorID }));
                //sandra end
                // redisClnt.get('CustomerRedisLastRec' + msg.guid, d.bind(function (err, reply) {
                redisClnt.get('IsCustomerConnect' + msg.guid, d.bind(function (err, reply) {
                    if (reply) {
                        var now = new Date();
                        var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                        var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                        var reply = JSON.stringify({ action: 'OperatorHangUp', opname: msg.OperatorName, opid: sessionInfo.OperatorID, msg: msg.msg, guid: msg.guid, istransfer: msg.istransfer, localtime: sdate, servertime: udate, priority: msg.priority });

                        objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 80, msg.guid, d.bind(function (err) {
                            if (err) { throw err; };
                        }));

                        store.lrange(msg.guid, 0, -1, d.bind(function (error, items) {
                            if (error) { throw error };
                            objDalayer.saveChatHistory(items, msg.guid, timeZoneName, d.bind(function (err) {
                                if (err) { throw err; };
                            }));
                        }));

                        objDalayer.cleanCallQueue(msg.guid, d.bind(function (err) {
                            if (err) { throw err; };
                        }));
                        //send message to operator added on 5/1/2014
                        socket.send(JSON.stringify({ action: 'OperatorHangUp', sender: msg.OperatorName, opid: sessionInfo.OperatorID, msg: msg.msg, guid: msg.guid, istransfer: msg.istransfer, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }));
                        /*start push and pub added on 5/1/2014*/

                        store.rpush(msg.guid, JSON.stringify({ action: 'OperatorHangUp', sender: msg.OperatorName, opid: sessionInfo.OperatorID, msg: msg.msg, guid: msg.guid, istransfer: msg.istransfer, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }), d.bind(function () {
                            store.rpush('CustomerMsgs' + msg.guid, JSON.stringify({ action: 'OperatorHangUp', sender: msg.OperatorName, opid: sessionInfo.OperatorID, msg: msg.msg, guid: msg.guid, istransfer: msg.istransfer, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }), d.bind(function () {

                                pub.publish(msg.guid, reply, d.bind(function () {
                                    sub.unsubscribe(msg.guid, d.bind(function () {

                                        redisClnt.lrem(sessionInfo.OperatorID, -1, msg.guid, d.bind(function (err) {
                                            redisClnt.llen(sessionInfo.OperatorID, d.bind(function (err, len) {
                                                if (len == 0) {
                                                    if (err) { throw err; };
                                                    objDalayer.updateUserActivities(parseInt(sessionInfo.OperatorID), 60, msg.guid, d.bind(function (err) {
                                                        if (err) { throw err; };

                                                    }));
                                                }
                                            }));
                                        }));
                                        //redisClnt.del('IsCustomerConnect' + msg.guid);
                                        //redisClnt.del('CustomerMsgs' + msg.guid);
                                        //redisClnt.del('OperatorMsgs' + msg.guid);
                                        //redisClnt.del('IsEscalated' + msg.guid);
                                        //redisClnt.del('SupervisorRedisLastRec' + msg.guid);
                                        //redisClnt.del(msg.guid + 'Timeout');
                                        sub.removeListener('message', callback);
                                    }));

                                }));
                            }));

                        }));
                        /*end push and pub*/

                    }
                }));



            }));
            //On customer hangup (CUSTOMER EVENT)
            socket.on('CustomerHangUp', d.bind(function (data) {
                //console.log('CustomerHangUp');
                var msg = JSON.parse(data);
                //redisClnt.get('CustomerRedisLastRec' + msg.guid, d.bind(function (err, reply) {
                redisClnt.get('IsCustomerConnect' + msg.guid, d.bind(function (err, reply) {
                    if (reply) {
                        var now = new Date();
                        var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                        var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");

                        var reply = JSON.stringify({ action: 'CustomerHangUp', custname: msg.VisitorName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                        //send message to customer added on 5/1/2014
                        socket.send(JSON.stringify({ action: 'CustomerHangUp', sender: msg.VisitorName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }));
                        /*start push and pub added on 5/1/2014*/
                        store.rpush(msg.guid, JSON.stringify({ action: 'CustomerHangUp', sender: msg.VisitorName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }), d.bind(function () {
                            store.rpush('OperatorMsgs' + msg.guid, JSON.stringify({ action: 'CustomerHangUp', sender: msg.VisitorName, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: 'System' }), d.bind(function () {

                                pub.publish(msg.guid, reply, d.bind(function () {
                                    sub.unsubscribe(msg.guid, d.bind(function () {
                                        //this logic will run only when operator logout for system by crash and not release the redis resource.
                                        socket.get('operatorConnectedToChat', d.bind(function (err, operatorId) {
                                            if (err) { throw err; };
                                            //console.log('OnCustomerHangup Operator id:-' + operatorId);
                                            //console.log('Message from CustomerHangUp:-' + operatorId);
                                            objDalayer.oprCurrentStatus(operatorId, d.bind(function (err, currentStatus) {
                                                if (err) { throw err; };
                                                if (parseInt(currentStatus) == 0) {
                                                    //Rename redis GUID instead of Delete
                                                    store.del(msg.guid);
                                                    var now = new Date();
                                                    var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy-HH:mm:ss");
                                                    //console.log(msg.guid + '_' + udate);
                                                    //store.rename(msg.guid, msg.guid + '_' + udate);
                                                    redisClnt.lrem(operatorId, -1, msg.guid);
                                                    //this code commented on 5/2/2014
                                                    /*redisClnt.del('OperatorRedisLastRec' + msg.guid);
                                                    redisClnt.del('CustomerRedisLastRec' + msg.guid);*/
                                                    redisClnt.del('IsCustomerConnect' + msg.guid);
                                                    redisClnt.del('CustomerMsgs' + msg.guid);
                                                    redisClnt.del('OperatorMsgs' + msg.guid);
                                                    redisClnt.del('IsEscalated' + msg.guid);
                                                    redisClnt.del('SupervisorRedisLastRec' + msg.guid);

                                                }


                                            }));
                                        }));
                                        sub.removeListener('message', callback);
                                    }));
                                }));

                            }));


                        }));
                        /*end push and pub*/

                        iscusthangup = 'true';
                    }
                }));
            }));
            //clear redis list for chat using guid
            socket.on('clearRedisList', d.bind(function (guid) {
                //console.log('clear redis list for:- ' + guid)
                //Rename redis GUID instead of Delete
                redisClnt.del('IsCustomerConnect' + guid);
                redisClnt.del('CustomerMsgs' + guid);
                redisClnt.del('OperatorMsgs' + guid);
                redisClnt.del('IsEscalated' + guid);
                redisClnt.del('SupervisorRedisLastRec' + guid);
                redisClnt.del(guid + 'Timeout');
                store.del(guid);
                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy-HH:mm:ss");
                console.log(guid + '_' + udate);
                //store.rename(guid, guid + '_' + udate);
            }));
            //on operator hangup reply by customer
            socket.on('ChatClosed', d.bind(function () {
                iscusthangup = 'true';
            }));
            //On operator typing
            socket.on('OperatorTyping', d.bind(function (data) {
                var msg = JSON.parse(data);
                var reply = JSON.stringify({ action: 'OperatorTyping', sender: msg.sender, indication: msg.indication, guid: msg.guid });
                pub.publish(msg.guid, reply);
            }));
            //On customer typing
            socket.on('CustomerTyping', d.bind(function (data) {
                var msg = JSON.parse(data);
                var reply = JSON.stringify({ action: 'CustomerTyping', sender: msg.sender, indication: msg.indication, guid: msg.guid });
                pub.publish(msg.guid, reply);
            }));
            //On customer typing display message to operator
            socket.on('CustomerTypingWords', function (data) {
                var msg = JSON.parse(data);
                var reply = JSON.stringify({ action: 'DisplayCustomerTypingMessage', sender: msg.sender, indication: msg.indication, guid: msg.guid });
                pub.publish(msg.guid, reply);
            });

            //Sandra start2
            socket.on('UsedSuggestion', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var ListName = Data.ListName;
                //console.log('i am Guid from survey complete' + guid);
                // console.log('i am Message from survey complete' + Data.Message);
                SandraStore.rpush(ListName, JSON.stringify({ action: 'UsedSuggestion', Message: Data.Suggested, GuID: guid, Type: 'ICE' }));
            }));
            socket.on('SurveyCompleted', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var ListName = Data.RedisListName;
                //console.log('i am Guid from survey complete' + guid);
                //console.log('i am Message from survey complete' + Data.Message);
                SandraStore.rpush(ListName, JSON.stringify({ action: 'SurveyCompleted', GuID: guid, Message: Data.Message, Type: 'ICE' }));
                pub.publish(guid, JSON.stringify({ action: 'SurveyCompleted', GuID: guid, Message: Data.Message }));
            }));


            socket.on('InChat', d.bind(function (Data) {

                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var RedisList = Data.RedisListName;

                SandraStore.rpush(RedisList, JSON.stringify({ action: 'CreateInChat', GuID: guid }));

            }));


            socket.on('PostChatSurveyAnswer', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var RedisList = Data.RedisListName;
                var answer = Data.Answer;
                var Question = Data.Question;
                //console.log('*************i am in PostChatSurveyAnswer****************** ' + Question + answer);
                //console.log('*************i am in PostChatSurveyAnswer****************** ');
                SandraStore.rpush(RedisList, JSON.stringify({ GuID: Data.GuID, PostChatSurveyQuestion: Question, PostChatSurveyAnswer: answer }));
                //pub.publish(guid, JSON.stringify({ action: 'InChatPost', GuID: inchat.GuID, Flag: inchat.Flag, Message: inchat.Question }));

            }));
            socket.on('InChatPost', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var RedisList = Data.RedisListName;
                var CurrQuestion = Data.CurrentQuestionNo;

                console.log('inside inchatpost');
                console.log(RedisList);
                console.log(CurrQuestion);
                SandraStore.rpush(RedisList, JSON.stringify({ action: 'InChatPostSurveyQustn', GuID: Data.GuID, CurrentQuestionNo: CurrQuestion }));
                //pub.publish(guid, JSON.stringify({ action: 'InChatPost', GuID: inchat.GuID, Flag: inchat.Flag, Message: inchat.Question }));

            }));

            socket.on('PostChatSurvey', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                // var RedisList = Data.RedisListName;
                var CurrQuestion = Data.CurrentQuestionNo;

                pub.publish(guid, JSON.stringify({ action: 'InChatPost', GuID: guid, Message: Data.Question, CurrentQuestionNo: CurrQuestion }));

            }));


            socket.on('CreateInChat', d.bind(function (Data) {
                Data = JSON.parse(Data);
                var guid = Data.GuID;
                var RedisList = Data.RedisListName;
                pub.publish(guid, JSON.stringify({ action: 'InChat', GuID: guid, Flag: Data.Flag, Message: Data.Question }));
            }));






            socket.on('ResponseOfInChat', d.bind(function (Data) {
                var Data = JSON.parse(Data);
                var guid = Data.GuID;
                var ResponseAns = Data.ResponseAnswerCus;
                var ListName = Data.ListName;
                SandraStore.rpush(ListName, JSON.stringify({ action: 'ResponseOfInchat', GuID: guid, Question: Data.Question, ResponseAnswer: ResponseAns, Type: 'ICE' }));

            }));

            socket.on('addWorker', d.bind(function (guid) {


                addWorker();


            }));




            //Sandra end2

            //Supervisor Start

            socket.on('SetEscalateChat', d.bind(function (guid) {
                redisClnt.set('IsEscalated' + guid, 1);
            }));

            socket.on('SupervisorChatConnect', d.bind(function (OperatorName, guid, offset) {
                OrgOffset = offset;
                sub.subscribe(guid, d.bind(function () {
                    redisClnt.set('SupervisorRedisLastRec' + guid, 0, d.bind(function () {
                        pub.publish(guid, JSON.stringify({ action: 'SupervisorConnected', guid: guid }));
                    }));
                }));
                /*
                var ChatHistory = '';
                store.lrange(guid, 0, -1, function (error, items) {
                items.forEach(function (item) {
                var data = JSON.parse(item);
                if (data.action == 'PrivateMessage') {
                ChatHistory += "<span> <u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#FF0000'>" + data.msg + "</font></span></br>";
                }
                else if (data.action == 'OperatorConnect') {
                ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<font color=\"#003399\">" + data.msg + "</font></span></br>";
                }
                else if (data.action == 'PushURL') {
                ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#003399'>" + data.msg + "</font></span></br>";
                }
                else if (data.action == 'Message') {
                ChatHistory += "<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender + "</b>: " + "<font color='#003399'>" + data.msg + "</font></span></br>";
                }
                })
                //console.log('Chat History:' + ChatHistory);
                var reply = JSON.stringify({ action: 'SupervisorConnect', sender: '', msg: ChatHistory, guid: guid });
                socket.send(reply);
                });*/
            }));

            //send message from supervisor
            socket.on('supchat', d.bind(function (data) {
                var msg = JSON.parse(data);
                var now = new Date();
                var udate = (new Date(now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
                var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                var sdate = (new Date(utc + (60000 * OrgOffset))).toString("HH:mm:ss");
                if (msg.action == 'PrivateMessage') {
                    var reply = JSON.stringify({ action: 'PrivateMessage', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                    pub.publish(msg.guid, reply);
                }
                else {
                    var reply = JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from });
                    //send message to operator added on 5/1/2014
                    //socket.send(JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }));
                    /*start push and pub added on 5/1/2014*/
                    store.rpush(msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), function () {
                        store.rpush('OperatorMsgs' + msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), d.bind(function () {
                            store.rpush('CustomerMsgs' + msg.guid, JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg, guid: msg.guid, localtime: sdate, servertime: udate, priority: msg.priority, from: msg.from }), d.bind(function () {
                                pub.publish(msg.guid, reply);
                            }));
                        }));
                    });
                    /*end push and pub*/
                }
            }));

            //Close Monitor Chat
            socket.on('SupCloseChat', d.bind(function (guid) {
                sub.unsubscribe(guid);
            }));

            //Supervisor End

            //sub on "message event"
            sub.addListener('message', d.bind(function (channel, message) {

                //callback(channel, message);
                Asynccallback(channel, message);
            }));

            var callback = function (channel, message) {


                //                console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
                //                console.log(message);
                //                console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
                var msg = JSON.parse(message);

                if (msg.action == 'OperatorTyping' || msg.action == 'CustomerTyping' || msg.action == 'DisplayCustomerTypingMessage' || msg.action == 'NewConnection' || msg.action == 'OperatorCloseConsole' || msg.action == 'OperatorResponded' || msg.action == 'AcceptTransfer' || msg.action == 'RejectTransfer' || msg.action == 'ConfirmTransfer' || msg.action == 'TransferConnection' || msg.action == 'CustomerChatDisconnected' || msg.action == 'CreateActionItemPost' || msg.action == 'SurveyCompleted' || msg.action == 'InChatPost' || msg.action == 'InChat' || msg.action == 'addWorker' || msg.action == 'CreateActionItem' || msg.action == 'AskMessage' || msg.action == 'CustomerDetail' || msg.action == 'PostChatSurvey' || msg.action == 'PostSurveyQustn' || msg.action == 'PrivateMessage') {
                    // msg.action == 'CustomerRejoin' ||
                    socket.send(message);
                }
                else {

                    if (typeof (sessionInfo) != 'undefined') {
                        console.log('SessionInfo:-' + sessionInfo.UserName);
                        redisClnt.get('OperatorRedisLastRec' + msg.guid, d.bind(function (err, reply) {
                            if (err) { throw err; };
                            if (reply) {

                                store.lrange(msg.guid, reply, -1, d.bind(function (err, replies) {

                                    if (err) { throw err; };
                                    var msgCnt = parseInt(reply);
                                    replies.forEach(function (msgStrored) {
                                        //socket.send(reply);
                                        socket.emit('chatMsg', msgStrored, function (Data) {
                                            var sendingMsg = JSON.parse(msgStrored);
                                            msgCnt = parseInt(msgCnt) + 1;
                                            redisClnt.set('OperatorRedisLastRec' + msg.guid, msgCnt, function () {
                                            });
                                            console.log('My Data:-' + Data);
                                            if (Data == 'OperatorConnect') {
                                                console.log('emit event for greeting');
                                                socket.emit("sendGreetingMsg", sendingMsg.sender, sendingMsg.guid)
                                            }
                                        });
                                        if (msg.action == 'OperatorHangUp') {
                                            //cleanup code for redis property
                                            redisClnt.del('OperatorRedisLastRec' + msg.guid);
                                            redisClnt.del('CustomerRedisLastRec' + msg.guid);
                                        }
                                    });

                                    /*
                                    var msgCnt = parseInt(replies.length) + parseInt(reply);
                                    redisClnt.set('OperatorRedisLastRec' + msg.guid, msgCnt, function () {

                                    replies.forEach(function (reply) {
                                    socket.send(reply);
                                    socket.emit('news', reply, function (data) {
                                    console.log(data);
                                    });
                                    if (msg.action == 'OperatorHangUp') {
                                    //cleanup code for redis property
                                    redisClnt.del('OperatorRedisLastRec' + msg.guid);
                                    redisClnt.del('CustomerRedisLastRec' + msg.guid);
                                    }
                                    });

                                    });*/

                                }));
                            }
                        }));

                    } else {

                        redisClnt.get('CustomerRedisLastRec' + msg.guid, d.bind(function (err, reply) {
                            if (err) { throw err; };
                            if (reply) {
                                console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                                console.log('Customer Redis Last Record:-' + reply);
                                console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                                store.lrange(msg.guid, reply, -1, d.bind(function (err, replies) {
                                    if (err) { throw err; };
                                    var msgCnt = parseInt(reply);

                                    replies.forEach(function (msgStrored) {
                                        //socket.send(reply);
                                        console.log('Message for customer:-' + msgStrored);
                                        socket.emit('chatMsg', msgStrored, function (Data) {
                                            //console.log('Callback customer for:-' + Data);
                                            msgCnt = parseInt(msgCnt) + 1;
                                            console.log('Customer MsgCnt:-' + msgCnt);
                                            redisClnt.set('CustomerRedisLastRec' + msg.guid, msgCnt, function () {
                                            });
                                        });

                                    });

                                    /*
                                    var msgInitCnt = 0;
                                    var msgCnt = parseInt(replies.length) + parseInt(reply);
                                    console.log('customer records length:-' + replies.length);
                                    redisClnt.set('CustomerRedisLastRec' + msg.guid, msgCnt, function () {
                                    replies.forEach(function (reply) {
                                    console.log('Message Type:-' + msg.action);
                                    socket.send(reply);

                                    });

                                    });*/

                                }));
                            }
                        }));
                    }

                }

            };

            function MsgPopCallBack(guid, MsgCallback) {

                MsgCallback(guid);

                /*setTimeout(function(){
                MsgCallback(guid);
                },500)*/

            }
            var Asynccallback = function (channel, message) {

                var msg = JSON.parse(message);

                if (msg.action == 'OperatorTyping' || msg.action == 'CustomerTyping' || msg.action == 'DisplayCustomerTypingMessage' || msg.action == 'NewConnection' || msg.action == 'OperatorCloseConsole' || msg.action == 'OperatorResponded' || msg.action == 'AcceptTransfer' || msg.action == 'RejectTransfer' || msg.action == 'ConfirmTransfer' || msg.action == 'TransferConnection' || msg.action == 'CustomerChatDisconnected' || msg.action == 'CreateActionItemPost' || msg.action == 'SurveyCompleted' || msg.action == 'InChatPost' || msg.action == 'InChat' || msg.action == 'addWorker' || msg.action == 'CreateActionItem' || msg.action == 'AskMessage' || msg.action == 'CustomerDetail' || msg.action == 'PostChatSurvey' || msg.action == 'PostSurveyQustn' || msg.action == 'PrivateMessage') {
                    // msg.action == 'CustomerRejoin' ||
                    socket.send(message);
                }
                else {
                    socket.emit('ClientIsAvailable', 'CheckAvail', function (Data) {
                        console.log('*******************************');
                        console.log(msg.action);
                        console.log('Callback success!!!!!' + Data);
                        console.log('*******************************');

                        if (typeof (sessionInfo) != 'undefined') {
                            console.log('Role:-' + sessionInfo.Role);
                            //if (sessionInfo.Role == '2') {
                            redisClnt.get('IsEscalated' + msg.guid, d.bind(function (err, reply) {
                                if (err) { throw err; };
                                console.log('IsEscalated1:-' + reply);
                                if (sessionInfo.Role == '2' && reply == null) {
                                    console.log('IsEscalated2:-' + reply);
                                    //read data from customer msgs added list
                                    redisClnt.lrange('OperatorMsgs' + msg.guid, 0, -1, d.bind(function (err, replies) {
                                        if (err) { throw err; };

                                        replies.forEach(function (oprMsg) {
                                            if (oprMsg) {
                                                redisClnt.lpop('OperatorMsgs' + msg.guid, function (err, Data) {
                                                    socket.send(Data);
                                                });
                                            }

                                        });

                                    }));



                                }
                                else if (reply && sessionInfo.Role == '3') {
                                    console.log('SessionInfo:-' + sessionInfo.UserName);
                                    //read data from customer msgs added list

                                    redisClnt.lrange('OperatorMsgs' + msg.guid, 0, -1, d.bind(function (err, replies) {
                                        if (err) { throw err; };

                                        replies.forEach(function (oprMsg) {
                                            if (oprMsg) {
                                                redisClnt.lpop('OperatorMsgs' + msg.guid, function (err, Data) {
                                                    socket.send(Data);
                                                });
                                            }

                                        });

                                    }));


                                } else if (!reply && sessionInfo.Role == '3') {

                                    redisClnt.get('SupervisorRedisLastRec' + msg.guid, d.bind(function (err, reply) {
                                        if (err) { throw err; };
                                        if (reply) {

                                            store.lrange(msg.guid, reply, -1, d.bind(function (err, replies) {
                                                if (err) { throw err; };
                                                var msgCnt = parseInt(reply);

                                                replies.forEach(function (msgStrored) {

                                                    socket.emit('chatMsg', msgStrored, function (Data) {
                                                        msgCnt = parseInt(msgCnt) + 1;
                                                        redisClnt.set('SupervisorRedisLastRec' + msg.guid, msgCnt, function () {
                                                        });
                                                    });

                                                });

                                            }));
                                        }
                                    }));
                                }
                            }));


                            //}
                        } else {

                            //read data from operator msgs added list
                            redisClnt.lrange('CustomerMsgs' + msg.guid, 0, -1, d.bind(function (err, replies) {
                                if (err) { throw err; };

                                replies.forEach(function (oprMsg) {
                                    if (oprMsg) {
                                        redisClnt.lpop('CustomerMsgs' + msg.guid, function (err, Data) {
                                            socket.send(Data);
                                        });
                                    }

                                });

                            }));

                        }
                    });


                }

            };
        }));
        function addWorker() {

            SandraStoreForBRPOP.brpop('S2I', 0, function (err, data) {


                if (data == undefined || data == 'null' || data == '') {

                }
                else {

                    var data1 = JSON.parse(data[1]);
                    var Guid_Sandra = data1.GuID;
                    store.publish(Guid_Sandra, data[1]);


                }
                addWorker();


            });
        }
    })
};






