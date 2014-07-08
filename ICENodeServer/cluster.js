var cluster = require('cluster');
var workers = process.env.WORKERS || require('os').cpus().length;
console.log("Starting new node...");
if (cluster.isMaster) {
 console.log('start cluster with %s workers', workers);
  for (var i = 0; i < workers; ++i) {
    var worker = cluster.fork().process;
    console.log('worker %s started.', worker.pid);
  }
  cluster.on('disconnect', function(worker) {
    console.error('disconnect!');
	/*var exitCode = worker.process.exitCode;
    console.log('worker ' + worker.process.pid + ' died ('+exitCode+'). restarting...');*/
    cluster.fork();
  });
   //restart on death of any sub process
  cluster.on('exit', function (worker, code, signal){
	var exitCode = worker.process.exitCode;
    console.log('worker ' + worker.process.pid + ' died ('+exitCode+'). restarting...');
    //cluster.fork();
    //console.log(cluster.workers);
  });

} else {
  require('./expressserver.js').initServer(cluster);
}

