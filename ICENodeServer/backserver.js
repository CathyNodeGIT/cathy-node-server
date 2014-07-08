var express = require('express')
    //, routes = require('./routes')
    , http = require('http')
    , path = require('path')
    , redis = require('redis');


var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

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
sessionSockets.on('connection', function (err, socket, session) {
    var sessionInfo;
    var currentChannel;
    
	var sub = redis.createClient();
    var pub = redis.createClient();
    socket.on('jointochannel', function (data) {
        var data = JSON.parse(data);
        currentChannel = data.channel;
		//sub.subscribe(currentChannel);
        console.log('current channel:-' + currentChannel + ' for user' + sessionInfo.UserName);
		socket.send(JSON.stringify({ action: 'clearskill',skill: currentChannel}));
		store.lrange(currentChannel, 0, -1, function (error, items) {
				if (error) throw error
				items.forEach(function (item) {
					socket.send(item);
				})
			})
    });
    socket.on('disconnectMe', function () {
        console.log('DisconnectedMe');
        console.log('User:-' + sessionInfo.UserName + ' has been disconnected');

        sessionInfo.SkillId.split(',').forEach(function (channel, i) {
			var msg=JSON.stringify({ action: 'disc', user: sessionInfo.UserName, msg: ' has been disconnected.', skill: channel});
            pub.publish(channel,msg);
			sub.unsubscribe(channel, function () {
                console.log('Unsubscribing to ' + channel + ' channel.');				
            });
        });
		
        sub.removeListener('message', callback);
    });
    socket.on("disconnect", function () {
        console.log('User:-' + sessionInfo.UserName + ' has been disconnected');

        sessionInfo.SkillId.split(',').forEach(function (channel, i) {
            sub.unsubscribe(channel, function () {
                console.log('Unsubscribing to ' + channel + ' channel.');
            });
        });
        sub.removeListener('message', callback);
    });
    socket.on('join', function (data) {
        var data = JSON.parse(data);
        console.log('join group');
        console.log(data.tockenId);
        //socket.send(data.tockenId);
        redisClnt.get(data.tockenId, function (err, reply) {
            sessionInfo = JSON.parse(reply);
            console.log('LoginTime:-' + sessionInfo.LoginTime);
            console.log('OperatorId:-' + sessionInfo.OperatorID);
            console.log('OrgID:-' + sessionInfo.OrgID);
            // console.log('Skill:-' + sessionInfo.Skill);
            console.log('UserName:-' + sessionInfo.UserName);
            sessionInfo.SkillId.split(',').forEach(function (channel, i) {
                sub.subscribe(channel, function () {
                    console.log('subscribing to ' + channel + ' channel.');
					var sdate=(new Date()).toString("MM/dd/yyyy HH:mm:ss");
                    var reply = JSON.stringify({ action: 'control', user: sessionInfo.UserName, msg: ' join the room.', skill: channel,localtime:data.localtime,servertime:sdate,filelink:'',priority:'1' });
                    pub.publish(channel, reply);
					//store.rpush(channel, reply);
                });

            });
            socket.emit('createSkill', JSON.stringify({ skillName: sessionInfo.SkillName, skillId: sessionInfo.SkillId, user: sessionInfo.UserName }))
        });
    });
    //get message from client
    socket.on('chat', function (data) {
        var msg = JSON.parse(data);
        var sdate=(new Date()).toString("MM/dd/yyyy HH:mm:ss");
		currentChannel=msg.currentskill;
		var reply = JSON.stringify({ action: 'message', user: sessionInfo.UserName, msg: msg.msg,skill:currentChannel,localtime:msg.localtime,servertime:sdate,filelink:msg.filelink,priority:msg.priority });
        console.log('current channel:-' + currentChannel + ' for user' + sessionInfo.UserName);
        console.log(reply);
        //sub.subscribe(currentChannel);
		pub.publish(currentChannel,reply);
		store.rpush(currentChannel,reply);
    });

    //sub on "message event"
    sub.addListener('message', function (channel, message) {

        callback(channel, message);
    });

    var callback = function (channel, message) {
        console.log('Channel:-' + channel);
        socket.send(message);
    };

});




server.listen(app.get('port'), function () {
    var serverName = process.env.VCAP_APP_HOST ? process.env.VCAP_APP_HOST + ":" + process.env.VCAP_APP_PORT : 'localhost:3000';
    console.log("Express server listening on " + serverName);
});
