var net = require('net');
var fs = require('fs');
var filePath = process.env.filePath;
var fileSocket = net.createConnection(9090, process.env.serverAddress,function(){
	process.send({type:'serverConnectionEstablished'});
});
var ws = fs.createWriteStream(filePath,{bufferSize: 1024 * 1024});
fileSocket.pipe(ws);
var timeStamp = new Date().getTime();
var speedCheck = setInterval(function(){
	var now = new Date().getTime();
	var speed = Math.round((fileSocket.bytesRead/((now - timeStamp)/1000))/1024);
	process.send({type:'progressUpdate',speed:speed,bytesRead:fileSocket.bytesRead});
},1000);

fileSocket.on('close',function(){
	process.send({type:'workerExit',bytesRead:fileSocket.bytesRead});	
	clearInterval(speedCheck);
	fileSocket.destroy();	
	process.exit();
});
fileSocket.on('error',function(err){
	process.send({type:'error',err:err});	
});