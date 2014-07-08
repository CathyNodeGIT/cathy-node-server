var express = require('express')
    //, routes = require('./routes')
    , http = require('http')
    , path = require('path')
    , redis = require('redis')
	, sql = require('mssql');

require('./date.js');
//require('./timezone.js');

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
//Sandra start
var isSandra=0;
//Sandra end
io.set('log level', 1);

var RedisStore = require('connect-redis')(express),
    rClient = redis.createClient(),
    sessionStore = new RedisStore({ client: rClient });

var cookieParser = express.cookieParser('00101244');

var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

app.configure(function () {
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(allowCrossDomain);
    app.use(cookieParser);
    app.use(express.session({ store: sessionStore, key: 'jsessionid', secret: '00101244' }));
    app.use(express.methodOverride());
    app.use(app.router);

    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

//app.get('/', routes.index);

app.get('/logout', function (req, res) {
    // req.session.destroy();
    // res.redirect('/');
});

app.post('/user', function (req, res) {
    req.session.user = req.body.user;
    req.session.save();
    res.json({ "error": "" });
    //console.log(req.session.user);
});
var store = redis.createClient();
var SessionSockets = require('session.socket.io');
var sessionSockets = new SessionSockets(io, sessionStore, cookieParser, 'jsessionid');
var redisClnt = redis.createClient();

var sqlconn = {
    user: 'sa',
    password: 'effective1?',
    server: 'et3ebs6117',
    database: 'eChatDebug'
}

sessionSockets.on('connection', function (err, socket, session) {
    var sessionInfo;
    var currentChannel;
	var channels=[];
	var reqfrom='';
	var reqopname='';
	var reqopguid='';
	var reqguid='';
	var reqcustname='';
	var islogout='false';
	var iscusthangup='false';
	var timeZoneName='';
	var IsTimeSlabNeed;
	var TransferTo='';
	var IsOperatorCS='false';
	var IsVisitorCS='false';
	var CSStatus='false';
	var ChatTypeVal='';
	var OrgOffset=0;
    
	var sub = redis.createClient();
    var pub = redis.createClient();
	//console.log('Transport type:'io.transports[socket.id].name);
	//On Operator Login
	
	socket.on('join', function (tockenId) {
		redisClnt.get(tockenId, function (err, reply) {
            sessionInfo = JSON.parse(reply);
			console.log('OperatorId:-' + sessionInfo.OperatorID);
			console.log('OperatorName:-' + sessionInfo.UserName);			
			socket.send(JSON.stringify({ action: 'ConnectNow',username:sessionInfo.UserName}));
        });		
	});
	socket.on('OperatorConnect', function (IP) {
		
		var address = socket.handshake.address;
		IP=address.address;
		reqfrom='Operator';
		sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('OperatorId', sql.Int, parseInt(sessionInfo.OperatorID));
			request.input('AgentState', sql.Int,10);
			request.input('Guid', sql.VarChar,'');
			request.execute('usp_UpdateOperatorStatusNew', function(err, recordsets, returnValue) {
				
			});
			
			var request = new sql.Request();
			request.input('userID', sql.Int, parseInt(sessionInfo.OperatorID));
			request.input('agentState', sql.VarChar,'10');
			request.input('currentIP', sql.VarChar,IP);
			request.input('incall', sql.Int,0);
			request.execute('usp_usersUpdateNew', function(err, recordsets, returnValue) {
				
			});			
			
			var request = new sql.Request();
			request.input('UserID', sql.Int, parseInt(sessionInfo.OperatorID));
			request.output('timezone', sql.VarChar);
			request.output('flag', sql.Bit);
			request.execute('GetTimeZoneByOperatorID', function(err, recordsets, returnValue) {
				console.log('timeZoneName:'+request.parameters.timezone.value);
				console.log('IsTimeSlabNeed:'+request.parameters.flag.value);
				timeZoneName=request.parameters.timezone.value;
				IsTimeSlabNeed=request.parameters.flag.value;
			});		

		});
		sub.subscribe('Operator'+sessionInfo.OperatorID);
	});
	//On Operator Logout
	socket.on('OperatorDisconnect', function () {
		OperatorDisconnect(parseInt(sessionInfo.OperatorID));
		islogout='true';
	});
	socket.on('getCurrentCustomerTimeStampStatus', function () {
		socket.send(JSON.stringify({ action: 'CurrentTimeStampStatus_CallBack',guid:reqopguid,isEnable:IsTimeSlabNeed,IsNewConnection:'false'}));
	});
	//On new chat initiate
	socket.on('NewChat', function (VisitorName,soName,chatType) {			
		ChatTypeVal=chatType;
		console.log(soName);
		
		//Sandra start1
		store.rpush('list1',JSON.stringify({action:soName}));
		store.rpush('list1',JSON.stringify({GuID:soName,action:'PostChatSurvey'}));
		//Sandra end1
		sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('Guid', sql.VarChar, soName);
			request.execute('usp_AssignOperator', function(err, recordsets, returnValue) {
				console.log(recordsets.length);
				console.log(returnValue);
				
				if(returnValue==0)
				{
					socket.send(JSON.stringify({ action: 'OperatorUnavailable'}));
				}
				else 
				{
					reqfrom='Visitor';
					reqguid=soName;
					reqcustname=VisitorName;
					sub.subscribe(soName);
					var req = new sql.Request();
					req.input('UserID', sql.Int, parseInt(returnValue));
					req.execute('usp_GetOperatorNameById', function(err, rs) {
						console.log('Operator Name:'+rs[0][0].forename);
						pub.publish('Operator'+returnValue,JSON.stringify({ action: 'NewConnection',guid:soName,visitor:VisitorName,operator:rs[0][0].forename,istransfer:'false'}));
					});
				}
			});
		});
			
	});
	
	socket.on('OperatorChatConnect', function (OperatorName,guid,offset) {
		OrgOffset=offset;
		console.log('Offset:'+OrgOffset);
		sub.subscribe(guid);
		channels.push(guid);
		reqopname=OperatorName;
		reqopguid=guid;
		AcceptCall(guid, parseInt(sessionInfo.OperatorID));
		if(channels.length==1)
		{
			UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 50, guid);
		}
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 70, guid);
		pub.publish(guid,JSON.stringify({ action: 'OperatorChatConnect',msg:OperatorName + " joined the conversation",guid:guid,opname:OperatorName,opid:sessionInfo.OperatorID}));
		
		var now=new Date();
		
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		console.log('UTC:'+udate+' Local:'+sdate);
		store.rpush(guid,JSON.stringify({ action: 'OperatorConnect',msg:OperatorName + " joined the conversation",guid:guid,sender:OperatorName,opid:sessionInfo.OperatorID,localtime:sdate,servertime:udate,from:'System'}));
		var greeting='';
		//Sandra start
		sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('cq_Guid', sql.VarChar, guid);
			request.output('IsSandra', sql.VarChar);
			request.execute('usp_GetIsSandraBySubCustomerID', function(err, recordsets, returnValue) {
				
				isSandra=request.parameters.IsSandra.value;
				console.log('IS SANDRA :'+ isSandra);
				});
				});
				
		//Sandra end
		sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('cq_Guid', sql.VarChar, guid);
			request.output('Greeting', sql.VarChar);
			request.execute('usp_GetGreetingBySubCustomerID', function(err, recordsets, returnValue) {
				console.log('Greeting:-'+request.parameters.Greeting.value);
				greeting=request.parameters.Greeting.value;
				if(greeting == undefined || greeting == 'null' || greeting=='')
				{
					greeting = "Welcome to the site...";
					console.log('Default Greeting:-'+greeting);					
				}
				pub.publish(guid,JSON.stringify({ action: 'GreetingMessage',guid:guid,opname:OperatorName,msg:greeting,localtime:sdate,offset:OrgOffset}));
				store.rpush(guid,JSON.stringify({ action: 'GreetingMessage',guid:guid,msg:greeting,guid:guid,sender:OperatorName,opid:sessionInfo.OperatorID,localtime:sdate,servertime:udate,from:'System'}));
			});
		});
		
	});
	socket.on('SetVisitorOffset', function (offset) {
        OrgOffset=offset;
    });
    socket.on('disconnectMe', function () {
        console.log('DisconnectedMe');
    });
    socket.on("disconnect", function () {
        if(reqfrom=='Operator')
		{
			if(islogout=='false')
			{
				if(channels.length>0)
				{
					console.log('Channels:'+channels.length);
					channels.forEach(function(channel) {
						
						var now=new Date();
						
						var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
						var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
						var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
						var reply = JSON.stringify({ action: 'OperatorHangUp', opname: reqopname,opid:sessionInfo.OperatorID, msg: 'Chat has been closed by Operator.',guid:channel,istransfer:'false',localtime:sdate,servertime:udate,priority:'1' });
						pub.publish(channel,reply);
						store.rpush(channel,JSON.stringify({ action: 'OperatorHangUp', sender: reqopname,opid:sessionInfo.OperatorID, msg: 'Chat has been closed by Operator.',guid:channel,istransfer:'false',localtime:sdate,servertime:udate,priority:'1',from:'System' }));
						UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 80, channel);
						if(channels.length==1)
						{
							UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 60, channel);
						}
						store.lrange(channel, 0, -1, function (error, items) {
							SaveChatHistory(items,channel,timeZoneName);
						});
						PerformCallQueueCleanup(channel);
						channels.splice(channels.indexOf(channel),1);
						 sub.unsubscribe(channel, function () {
								console.log('Operator Unsubscribing from ' + channel + ' channel.');
							});
						store.del(channel);
					});
				}
				OperatorDisconnect(parseInt(sessionInfo.OperatorID));
			}
		}
		else if(reqfrom=='Visitor')
		{
			if(iscusthangup=='false')
			{
				console.log('CustomerHangUp');
				var now=new Date();
				var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
				var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
				var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
				var msg1 = "<div><font color='#FF0000'>" + reqcustname + " left the conversation </font></div>";
				var reply = JSON.stringify({ action: 'CustomerHangUp', custname: reqcustname,msg: msg1,guid:reqguid,localtime:sdate,servertime:udate,priority:'1',from:reqfrom });
				pub.publish(reqguid,reply);
				store.rpush(reqguid,JSON.stringify({ action: 'CustomerHangUp', sender: reqcustname,msg: msg1,guid:reqguid,localtime:sdate,servertime:udate,priority:'1',from:'System' }));
				sub.unsubscribe(reqguid, function () {
						console.log('Customer Unsubscribing from ' + reqguid + ' channel.');
				});
			}
		}
    });
	//Set flag on Operator's first reponse to visitor
	socket.on('OperatorResponseToVisitor',function (){
		IsOperatorCS='true';
	});
    //send message from operator/visitor
    socket.on('chat', function (data) {        
		var msg = JSON.parse(data);
		//Sandra start		
		if(isSandra =='1')
		{
		if(msg.from.toLowerCase()=='visitor')
		{
		store.rpush('list1',JSON.stringify({CustMsg:msg.msg,GuID:msg.guid,action:'validate'}));
        }
		}
		//Sandra end
        
		var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'message', sender: msg.sender, msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
        console.log(reply);
        pub.publish(msg.guid,reply);
		store.rpush(msg.guid,JSON.stringify({ action: 'Message', sender: msg.sender, msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from }));
		
		if(reqfrom=='Operator')
		{
			if(IsOperatorCS=='false')
			{
				IsOperatorCS='true';
				pub.publish(msg.guid,JSON.stringify({ action: 'OperatorResponded'}));
			}
		}
		else if(reqfrom=='Visitor')
		{
			if(IsVisitorCS=='false')
			{
				IsVisitorCS='true';
			}
		}
		
		if(IsOperatorCS=='true' && IsVisitorCS=='true' && CSStatus=='false')
		{
			CSStatus='true';
			if(reqfrom=='Visitor')
			{
				UpdateConversattionStatus(msg.guid,ChatTypeVal);
			}
		}
    });
	
	//Push URL
	socket.on('PushURL',function(data){
		var msg = JSON.parse(data);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
		pub.publish(msg.guid,reply);
		store.rpush(msg.guid,JSON.stringify({ action: 'PushURL', sender: sessionInfo.UserName, msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from }));
	});
	
	//TransferAccept_Source
	socket.on('TransferAccept_Source',function(data){
		var msg = JSON.parse(data);
		TransferTo=msg.transferringoperator;
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 75, msg.guid);
	});
	
	//TransferReject_Source
	socket.on('TransferReject_Source',function(data){
		var msg = JSON.parse(data);
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 76, msg.guid);
	});
	//TransferAccept
	socket.on('TransferAccept',function(data){
		var msg = JSON.parse(data);
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 73, msg.guid);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'AcceptTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator'+sessionInfo.OperatorID,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
		pub.publish(msg.transferringoperator,reply);
	});
	//TransferReject
	socket.on('TransferReject',function(data){
		var msg = JSON.parse(data);
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 74, msg.guid);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'RejectTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator'+sessionInfo.OperatorID,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
		pub.publish(msg.transferringoperator,reply);
	});
	//OperatorTransfer
	socket.on('OperatorTransfer',function(data){
		var msg = JSON.parse(data);
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 72, msg.guid);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'ConfirmTransfer', sender: sessionInfo.UserName, transferringoperator: 'Operator'+sessionInfo.OperatorID,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
		pub.publish(msg.transferringoperator,reply);
	});
	//Disconnect chat on transfer
	socket.on('TransferdisconnectUser',function(data){
		var msg = JSON.parse(data);
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 81, msg.guid);
		if(channels.length==1)
		{
			UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 60, msg.guid);
		}
		channels.splice(channels.indexOf(msg.guid),1);
		sub.unsubscribe(msg.guid, function () {
			console.log('Operator Unsubscribing from ' + msg.guid + ' channel.');
		});
		socket.send(JSON.stringify({ action: 'disconnectChatCallback',guid:msg.guid}));
		//Transfer connection to new operator
		console.log('TransferTo:'+TransferTo);
		TransferCall(parseInt(sessionInfo.OperatorID), parseInt(TransferTo.substring(8)), msg.guid);
		sql.connect(sqlconn, function(err) {
			var req = new sql.Request();
			req.input('UserID', sql.Int, parseInt(TransferTo.substring(8)));
			req.execute('usp_GetOperatorNameById', function(err, rs) {
				console.log('Operator Name:'+rs[0][0].forename);
				pub.publish(TransferTo,JSON.stringify({ action: 'TransferConnection',guid:msg.guid,visitor:reqcustname,operator:rs[0][0].forename,istransfer:'true'}));
			});
		});
	});
	//Connect Transfereed chat to new operator
	socket.on('TransferChatConnect',function(OperatorName,guid,offset){
		OrgOffset=offset;
		console.log('Offset:'+OrgOffset);
		sub.subscribe(guid);
		channels.push(guid);
		reqopname=OperatorName;
		AcceptCall(guid, parseInt(sessionInfo.OperatorID));		
		if(channels.length==1)
		{
			UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 50, guid);
		}
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 71, guid);
		var ChatHistory='';
		store.lrange(guid, 0, -1, function (error, items) {			
			items.forEach(function (item) {
				var data = JSON.parse(item);				
				if(data.action=='PrivateMessage'){
					ChatHistory+="<span> <u>[" + data.localtime + "]</u> - " + "<b> " + data.sender  + "</b>: " +  "<font color='#FF0000'>" + data.msg + "</font></span></br>";
				}
				else if(data.action=='OperatorConnect'){
					ChatHistory+="<span><u>[" + data.localtime + "]</u> - " +  "<font color=\"#003399\">" + data.msg + "</font></span></br>";
				}
				else if(data.action=='PushURL'){
					ChatHistory+="<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender  + "</b>: " +  "<font color='#003399'>" + data.msg + "</font></span></br>";
				}
				else if(data.action=='Message'){
					ChatHistory+="<span><u>[" + data.localtime + "]</u> - " + "<b> " + data.sender  + "</b>: " +  "<font color='#003399'>" + data.msg + "</font></span></br>";
				}			
			})
			console.log('Chat History:'+ChatHistory);
			var reply = JSON.stringify({ action: 'TransferChat', sender: '', msg: ChatHistory,guid:guid });
			socket.send(reply);
		});		
		pub.publish(guid,JSON.stringify({ action: 'OperatorChatConnect',msg:OperatorName + " joined the conversation",guid:guid,opname:OperatorName,opid:sessionInfo.OperatorID}));
		var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		store.rpush(guid,JSON.stringify({ action: 'OperatorConnect',msg:OperatorName + " joined the conversation",guid:guid,sender:OperatorName,opid:sessionInfo.OperatorID,localtime:sdate,servertime:udate,from:'System'}));
	});
	
	//On operator hangup
	socket.on('OperatorHangUp',function (data) {
		
		var msg = JSON.parse(data);
		console.log('Operator HangUp:-'+msg.msg);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'OperatorHangUp', opname: msg.OperatorName,opid:sessionInfo.OperatorID, msg: msg.msg,guid:msg.guid,istransfer:msg.istransfer,localtime:sdate,servertime:udate,priority:msg.priority });
		pub.publish(msg.guid,reply);
		store.rpush(msg.guid,JSON.stringify({ action: 'OperatorHangUp', sender: msg.OperatorName,opid:sessionInfo.OperatorID, msg: msg.msg,guid:msg.guid,istransfer:msg.istransfer,localtime:sdate,servertime:udate,priority:msg.priority,from:'System' }));
		UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 80, msg.guid);
		if(channels.length==1)
		{
			UpdateOperatorStatus(parseInt(sessionInfo.OperatorID), 60, msg.guid);
		}
		store.lrange(msg.guid, 0, -1, function (error, items) {
				SaveChatHistory(items,msg.guid,timeZoneName);
			});
		PerformCallQueueCleanup(msg.guid);
		channels.splice(channels.indexOf(msg.guid),1);
		 sub.unsubscribe(msg.guid, function () {
                console.log('Operator Unsubscribing from ' + msg.guid + ' channel.');
            });
		store.del(msg.guid);
	});
	//On customer hangup
	socket.on('CustomerHangUp',function (data) {
		console.log('CustomerHangUp');
		var msg = JSON.parse(data);
		console.log(msg);
        var now=new Date();
		var udate=(new Date( now.getTime() + (now.getTimezoneOffset() * 60000))).toString("MM/dd/yyyy HH:mm:ss");
		var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		var sdate=(new Date(utc + (60000*OrgOffset))).toString("HH:mm:ss");
		var reply = JSON.stringify({ action: 'CustomerHangUp', custname: msg.VisitorName,msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:msg.from });
		pub.publish(msg.guid,reply);
		store.rpush(msg.guid,JSON.stringify({ action: 'CustomerHangUp', sender: msg.VisitorName,msg: msg.msg,guid:msg.guid,localtime:sdate,servertime:udate,priority:msg.priority,from:'System' }));
		sub.unsubscribe(msg.guid, function () {
                console.log('Customer Unsubscribing from ' + msg.guid + ' channel.');
        });
		iscusthangup='true';
	});
	//on operator hangup reply by customer
	socket.on('ChatClosed',function(){
		iscusthangup='true';
	});
	//On operator typing
	socket.on('OperatorTyping',function (data) {
		var msg = JSON.parse(data);
		var reply = JSON.stringify({ action: 'OperatorTyping', sender: msg.sender,indication: msg.indication,guid:msg.guid });
		pub.publish(msg.guid,reply);
	});
	//On customer typing
	socket.on('CustomerTyping',function (data) {
		var msg = JSON.parse(data);
		var reply = JSON.stringify({ action: 'CustomerTyping', sender: msg.sender,indication: msg.indication,guid:msg.guid });
		pub.publish(msg.guid,reply);
	});
	//On customer typing display message to operator
	socket.on('CustomerTypingWords',function (data) {
		var msg = JSON.parse(data);
		var reply = JSON.stringify({ action: 'DisplayCustomerTypingMessage', sender: msg.sender,indication: msg.indication,guid:msg.guid });
		pub.publish(msg.guid,reply);
	});
	
	//Sandra start2
	socket.on('UsedSuggestion', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
		console.log('i am Guid from survey complete'+guid);
	console.log('i am Message from survey complete'+Data.Message);
	store.rpush(Data.ListName,JSON.stringify({action:'UsedSuggestion',Message:Data.Suggested,GuID:guid}));
	});
	socket.on('SurveyCompleted', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
		console.log('i am Guid from survey complete'+guid);
	console.log('i am Message from survey complete'+Data.Message);
	pub.publish(guid,JSON.stringify({action:'SurveyCompleted',GuID:guid,Message:Data.Message}));
	});
	
	
	socket.on('InChat', function (Data) {
	
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
		
					store.rpush(RedisList,JSON.stringify({ action: 'CreateInChat',GuID:guid}));
			
	});
		socket.on('InChatPost', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
		store.lrange(guid+'qwe', 0, 0, function (error,items) {
		if (error) throw error
				items.forEach(function (item) {
					var inchat=JSON.parse(items);
					pub.publish(guid,JSON.stringify({action:'InChatPost',GuID:inchat.GuID, Flag:inchat.Flag,Message:inchat.Question}));
				
				})
				})
							
	});
		socket.on('InChatPost1', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
		store.lrange(guid+'qwe', 1, 1, function (error,items) {
		if (error) throw error
				items.forEach(function (item) {
					var inchat=JSON.parse(items);
					pub.publish(guid,JSON.stringify({action:'InChatPost1',GuID:inchat.GuID, Flag:inchat.Flag,Message:inchat.Question}));
				
				})
				})
			
			
	});
			socket.on('InChatPost2', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
		store.lrange(guid+'qwe', 2, 2, function (error,items) {
		if (error) throw error
				items.forEach(function (item) {
					var inchat=JSON.parse(items);
					pub.publish(guid,JSON.stringify({action:'InChatPost2',GuID:inchat.GuID, Flag:inchat.Flag,Message:inchat.Question}));
				
				})
				})
			
			
	});
	
		socket.on('CreateInChat', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
	pub.publish(guid,JSON.stringify({action:'InChat',GuID:guid, Flag:Data.Flag,Message:Data.Question}));
	});
		socket.on('InChatABC', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var RedisList=Data.RedisListName;
	pub.publish(guid,JSON.stringify({action:'InChat',GuID:guid, Flag:'4',Message:Data.Question}));
	});
	
		socket.on('TellMessage', function (Data) {
	Data=JSON.parse(Data);
	var guid=Data.GuID;
		store.lrange('RedisAsk', -1, -1, function (error,items) {
		if (error) throw error
				items.forEach(function (item) {
					var TellMessage=JSON.parse(item);
					var ShowToOp=TellMessage.TellOperator;
					var ShowToVis=TellMessage.TellVisitor;
					if(ShowToOp=="True" && ShowToVis=="False")
					{
					pub.publish(guid,JSON.stringify({action:'TellOperator',guid:guid,Message:TellMessage.TellMessage,OperatoName:Data.OperatorName}));
					}
					else if(ShowToOp=="False" && ShowToVis=="True")
					{
					pub.publish(guid,JSON.stringify({action:'TellVisitor',guid:guid,Message:TellMessage.TellMessage,OperatoName:Data.OperatorName}));
					}
					else if(ShowToOp=="True" && ShowToVis=="True")
					{
					pub.publish(guid,JSON.stringify({action:'TellBoth',guid:guid,Message:TellMessage.TellMessage,OperatoName:Data.OperatorName}));
					}
				})
				})
			
	});
	socket.on('CreateActionItemPost', function (Data) {
	
	if(isSandra =='1')
				{
	Data=JSON.parse(Data);
	var guid=Data.GuID;
	var ListName=Data.RedisListName;
	
				pub.publish(guid,JSON.stringify({action:'CreateActionItemPost',GuID:guid, Label:'PostChat Survey Request',InputType:'button'}));
			
			}
	});
	
		socket.on('ResponseOfInChat', function (Data) {
		var Data = JSON.parse(Data);
		var guid=Data.GuID;
		var ResponseAns=Data.ResponseAnswerCus;
		var ListName=Data.ListName;
			store.rpush(ListName,JSON.stringify({ action: 'ResponseOfInchat',GuID:guid,ResponseAnswer:ResponseAns}));
		
	});

	
	//Sandra end2

    //sub on "message event"
    sub.addListener('message', function (channel, message) {

        callback(channel, message);
    });

    var callback = function (channel, message) {
            socket.send(message);
    };

});

function AcceptCall(guid,opid)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('Guid', sql.VarChar,guid);
			request.input('OperatorId', sql.Int, opid);			
			request.execute('usp_AcceptCall', function(err, recordsets, returnValue) {
				
			});
		});
}

function UpdateOperatorStatus(opid,status,guid)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('OperatorId', sql.Int, opid);
			request.input('AgentState', sql.Int,status);
			request.input('Guid', sql.VarChar,guid);
			request.execute('usp_UpdateOperatorStatusNew', function(err, recordsets, returnValue) {
				
				});
			});
}

function PerformCallQueueCleanup(guid)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('GUID', sql.VarChar,guid);
			request.execute('usp_tbl_CallQueueCleanupByGuid', function(err, recordsets, returnValue) {
				
				});
			});
}

function OperatorDisconnect(opid)
{
	sql.connect(sqlconn, function(err) {
		var request = new sql.Request();
		request.input('OperatorId', sql.Int, opid);
		request.input('AgentState', sql.Int,20);
		request.execute('usp_DisconnectOperatorNew', function(err, recordsets, returnValue) {
		});
	});
}

function TransferCall(currentop,newop,guid)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('CurrentOperatorId', sql.Int, currentop);
			request.input('TransferOperatorId', sql.Int,newop);
			request.input('Guid', sql.VarChar,guid);
			request.execute('usp_TransferChatNew', function(err, recordsets, returnValue) {
				
				});
			});
}

function UpdateConversattionStatus(guid,ctype)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('Guid', sql.VarChar,guid);
			request.input('chatType', sql.VarChar, ctype);			
			request.execute('usp_UpdateConversationStatus', function(err, recordsets, returnValue) {
				
			});
		});
}

function countWords(s){
	s = s.replace(/(^\s*)|(\s*$)/gi,"");
	s = s.replace(/[ ]{2,}/gi," ");
	s = s.replace(/\n /,"\n");
	return s.split(' ').length;
}

function AddChatStatistics(guid, Sender, WordCount, LineCount, FromDate, ToDate, ResponseTimeInSeconds, ChatStarted, ChatwithResp, ResponseCount)
{
	sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('FromDate', sql.VarChar,FromDate);
			request.input('ToDate', sql.VarChar, ToDate);
			request.input('Guid', sql.VarChar,guid);
			request.input('Sender', sql.VarChar, Sender);	
			request.input('WordCount', sql.Int, WordCount);
			request.input('LineCount', sql.Int,LineCount);	
			request.input('ResTimeinSec', sql.Int, ResponseTimeInSeconds);
			request.input('ResCount', sql.Int,ResponseCount);
			request.input('ChatStarted', sql.Int, ChatStarted);
			request.input('ChatWithResp', sql.Int,ChatwithResp);			
			request.execute('usp_InsUpdChatAverages', function(err, recordsets, returnValue) {
				
			});
		});
}

function SaveChatHistory(items,guid,tzName)
{
	/*Add Chat Stats Variable Start*/
	
	var WordCount;
	var LineCount;
	var FromDate;
	var ToDate;
	var Sender;
	var ChatwithResp=0;
	var ResponseTimeInSeconds;
	var ResponseCount;
	var VsLastMsgTime='';
	var LastMsgFrom='';
	var VsChatwithResp='false';
	var OpLastMsgTime='';
	var OpChatwithResp='false';
	var i = 0;
	
	/*Add Chat Stats Variable End*/
	
	var ChatTranscript="<ChatHistory>";
				items.forEach(function (item) {
				 var data = JSON.parse(item);
				 
				 var messageType= data.action.toLowerCase();
				 
				 /* Add Chat Stats Calculation Start */
				 if(messageType=='message')
				 {
					WordCount = countWords(data.msg);
					LineCount = 1;					
					FromDate = (new Date(data.servertime)).toString("MM/dd/yyyy HH") + ":00:00";
					ToDate = (new Date(data.servertime)).toString("MM/dd/yyyy HH") + ":59:00";
					if(data.from == 'operator')
					{
						Sender = "Operator";
						if(VsLastMsgTime != '' && LastMsgFrom != '' && LastMsgFrom == "Visitor")
						{							
							if (VsChatwithResp == 'false')
							{
								ChatwithResp = 1;
								VsChatwithResp= 'true';
							}
							var dateStart = VsLastMsgTime;
							var dateStop = data.servertime;					        
							var d1 = new Date(dateStart);
							var d2 = new Date(dateStop);
							ResponseTimeInSeconds = (d2.getTime() - d1.getTime())/1000;
							ResponseCount = 1;
						}  
						else
						{
							ResponseTimeInSeconds = 0;
							ResponseCount = 0;
						}
					}
					else
					{
						Sender = "Visitor";
						if(OpLastMsgTime != '' && LastMsgFrom != '' && LastMsgFrom == "Operator")
						{
							if (OpChatwithResp == 'false')
							{
								ChatwithResp = 1;
								OpChatwithResp= 'true';
							}
							var dateStart = OpLastMsgTime;
							var dateStop = data.servertime;					        
							var d1 = new Date(dateStart);
							var d2 = new Date(dateStop);
							ResponseTimeInSeconds = (d2.getTime() - d1.getTime())/1000;
							ResponseCount = 1;
						}
						else
						{
							ResponseTimeInSeconds = 0;
							ResponseCount = 0;
						}
					}
											
					console.log('From Date:'+FromDate,' To Date:'+ToDate, ' Response Seconds:'+ResponseTimeInSeconds);
					if (i == 0)
					{
						AddChatStatistics(guid, Sender, WordCount, LineCount, FromDate, ToDate, ResponseTimeInSeconds, 1, ChatwithResp, ResponseCount);				
					}
					else
					{
						AddChatStatistics(guid, Sender, WordCount, LineCount, FromDate, ToDate, ResponseTimeInSeconds, 0, ChatwithResp, ResponseCount);
					}
					i=i+1;	
											
					if(data.from == 'operator')
					{
						OpLastMsgTime= data.servertime;
						LastMsgFrom= "Operator";	
					}
					else
					{
						VsLastMsgTime=data.servertime;
						LastMsgFrom= "Visitor";							
					}
				 }
				 /* Add Chat Stats Calculation End */
				 
				 if(messageType!= "customertyping" && messageType!="customertypingwords" && messageType!="operatortyping" && messageType!="timestampenable" && messageType!="customervideostatus" && messageType!="operatorvideostatus")
					{
					//console.log(item);
					ChatTranscript +="<MessageContent>";
			ChatTranscript +="<MessageType>";
			ChatTranscript += data.action;
			ChatTranscript +="</MessageType>";
			ChatTranscript +="<TimeZone>";
			//console.log(ChatTranscript);
			if(tzName!=null && tzName!=undefined && tzName!='')
			{
				ChatTranscript +=tzName;	
			}
			else
			{
				ChatTranscript +="GMT";
			}
			ChatTranscript +="</TimeZone>";
			
			ChatTranscript +="<TimeStamp>";
			//ChatTranscript +=data.servertime;
			ChatTranscript +=data.localtime;
			ChatTranscript +="</TimeStamp>";
			
			ChatTranscript +="<Message>";
			ChatTranscript +="<![CDATA[";
			//ChatToSave.append(chatData.getString("message"));
			var msg = data.msg;	
			var strMask = "";
			for (var i=0;i<msg.length;i++)
			{ 
			var ch = msg[i];
				
		       
		        switch (ch) {
		            case '1': 
		            strMask += "*";
		                     break;
		            case '2':  
		            strMask += "*";
		                     break;
		            case '3': 
		            	 strMask += "*";
		                     break;
		            case '4':  
		            	 strMask += "*";
		                     break;
		            case '5':  
		            	 strMask += "*";
		                     break;
		            case '6':  
		            	 strMask += "*";
		                     break;
		            case '7':  
		            	 strMask += "*";
		                     break;
		            case '8':  
		            	 strMask += "*";
		                     break;
		            case '9':  
		            	 strMask += "*";
		                     break;
		            case '0': 
		            	 strMask += "*";
		                     break;
		            
		            default:  strMask += ch;
		                     break;
		        }
			
			}
			ChatTranscript +=strMask;
			
			ChatTranscript +="]]>";
			
			ChatTranscript +="</Message>";
			ChatTranscript +="<SenderName>";
			ChatTranscript +=data.sender;
			ChatTranscript +="</SenderName>";
			
			ChatTranscript +="<Sender>";
			ChatTranscript +=data.from;
			ChatTranscript +="</Sender>";
			ChatTranscript +="</MessageContent>";
			}
				})
				
				ChatTranscript +="</ChatHistory>";
		console.log('-----------------------');
		console.log(ChatTranscript);
		console.log('-----------------------');
		sql.connect(sqlconn, function(err) {
			var request = new sql.Request();
			request.input('Guid', sql.VarChar, guid);
			request.input('Transcript', sql.VarChar,ChatTranscript);
			request.input('InteractiveChat', sql.TinyInt,1);
			request.execute('usp_DisconnectCall', function(err, recordsets, returnValue) {
				
			});
		});
}

server.listen(app.get('port'), function () {
    var serverName = process.env.VCAP_APP_HOST ? process.env.VCAP_APP_HOST + ":" + process.env.VCAP_APP_PORT : 'localhost:3000';
    console.log("Express server listening on " + serverName);
});
