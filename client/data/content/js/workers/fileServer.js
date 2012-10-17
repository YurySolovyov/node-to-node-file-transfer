var net = require('net');
var fs = require('fs');
var server = net.createServer(function (socket) {
	var filePath = process.env.filePath;
	var rs = fs.createReadStream(filePath,{bufferSize: 1024 * 1024});
	rs.pipe(socket);
	var timeStamp = new Date().getTime();
	var speedCheck = setInterval(function(){
		var now = new Date().getTime();
		var speed = Math.round((socket.bytesWritten/((now - timeStamp)/1000))/1024);
		process.send({type:'progressUpdate',speed:speed,bytesWritten:socket.bytesWritten});
	},1000);
	
	rs.on('end',function(){
		process.send({type:'workerExit',bytesWritten:socket.bytesWritten});
		clearInterval(speedCheck);
		socket.destroy();
		process.exit();
	});			
	
}).listen(9090,function(){
	process.send({type:'serverReady'});
});