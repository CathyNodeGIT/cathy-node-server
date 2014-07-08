
/**
* Module dependencies.
*/

var express = require('express')
   , http = require('http')
   , path = require('path')
   , connect = require('connect')
   , RedisStore = require('connect-redis')(express)
   , https = require('https')
   , fs = require('fs');

var options = {
    pfx: fs.readFileSync('EnterICEPrivate.pfx'),
    passphrase: 'ICEcold2013'
};

exports.initServer = function (cluster) {
    var app = express();
    var sessionStore = new RedisStore();
    var allowCrossDomain = function (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin, Referer, User-Agent');

        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
            res.send(200);
        }
        else {
            next();
        }
    }


    app.configure(function () {
        //app.set('port', process.env.PORT || 443);
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.favicon());
        app.use(express.logger('dev'));
        app.use(express.bodyParser());
        //app.use(allowCrossDomain);
        app.use(express.cookieParser('somesuperspecialsecrethere'));
        app.use(express.session({ key: 'express.sid', store: sessionStore }));
        app.use(express.methodOverride());
        app.use(function (req, res, next) {
            console.log('Protocol' + req.secure);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            next();
        });
        app.use(app.router);
        //app.use(express.static(path.join(__dirname, 'public')));
    });



    app.get('/', function (req, res) {
        res.send('Welcome To ICE');
    });
    app.get('/getmsg', function (req, res) {
        res.send('Welcome To ICE');

    });

    app.configure('development', function () {
        app.use(express.errorHandler());
    });

    var server = http.createServer(app).listen(3000, function(){
    console.log("Express server listening on port " + 3000);
    });
    /*
    var httpserver = http.createServer(app).listen(80, function(){
    console.log("Express server listening on port " + 80);
    });
    */



    /*var server = https.createServer(options, app).listen(443, function () {
        console.log("Express server listening on port " + 443);
    });*/

    require('./socket.js').initialize(server, cluster);
    //	require('./socket.js').initialize(httpserver,cluster);



}


