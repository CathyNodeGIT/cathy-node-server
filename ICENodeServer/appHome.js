var app = require('http').createServer(handler);
app.setMaxListeners(0);
app.listen(8088);
var io = require('socket.io').listen(app);
var redis = require('redis');
var fs = require('fs');
 
function handler(req,res){
    fs.readFile(__dirname + '/indexHome.html', function(err,data){
        if(err){
            res.writeHead(500);
            return res.end('Error loading indexHome.html');
        }
        res.writeHead(200);
        console.log("Listening on port 8088");
        res.end(data);
    });
}
 
var store = redis.createClient();
var pub = redis.createClient();
var sub = redis.createClient();
var curRoomid; 
io.set('log level', 1);
io.sockets.on('connection', function (client) {

	client.on('addroom', function(room){
		sub.subscribe(room);
	});
   //* sub.psubscribe("chatting*");
   //* sub.on("pmessage", function (pattern,channel, message) {
	 sub.on("message", function (channel, message) {
		//console.log("message received on server from patter" + pattern);
		console.log("message received on server from channel " + channel);
        console.log("message received on server from publish ");				
		curRoomid=channel;
	//	var msg = {JSON.stringify(message:message,roomid:channel)}
        //client.send(message);
		/*
		for (var i=0;i<store.llen(channel);i++)
		{
			var msg=JSON.stringify(store.lindex(channel,i));
			client.send(JSON.stringify({message: msg,roomid: channel}));
		}
		*/
		
		
		
		client.send(JSON.stringify({message: message,roomid: channel}));
    });
    client.on("message", function (msg) {
        console.log(msg);
        if(msg.type == "chat"){
			sub.subscribe(msg.roomid);
            pub.publish(msg.roomid,msg.message);
			store.rpush(msg.roomid,msg.message);
			/*store.lrange(msg.roomid, 0, -1, function (error, items) {
				if (error) throw error
				items.forEach(function (item) {
					client.send(JSON.stringify({message: item,roomid: msg.roomid}));
				*/
        }
        else if(msg.type == "setUsername"){
			sub.subscribe(msg.roomid);
			
			store.lrange(msg.roomid, 0, -1, function (error, items) {
				if (error) throw error
				items.forEach(function (item) {
					client.send(JSON.stringify({message: item,roomid: msg.roomid}));
				})
			})
			
            pub.publish(msg.roomid,"A new user in connected:" + msg.user);
			store.rpush(msg.roomid,"A new user in connected:" + msg.user);
            store.sadd("onlineUsers",msg.user);
			
			
			
        }
		else if(msg.type == "connect"){
			store.lrange(msg.roomid, 0, -1, function (error, items) {
				if (error) throw error
				items.forEach(function (item) {
					client.send(JSON.stringify({message: item,roomid: msg.roomid}));
				})
			})			
        }		
		curRoomid=msg.roomid;
		
    });
    client.on('disconnect', function () {
      //  sub.quit();
        pub.publish(curRoomid,"User is disconnected :" + client.id);
    });
     
  });