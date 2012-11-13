var net = require('net');
var fs = require('fs');
var server = net.createServer(function (socket) {
	var filePath = process.env.filePath;
	var rs = fs.createReadStream(filePath, {
		bufferSize: 1024 * 1024
	});
	try{
		rs.pipe(socket);
	}catch(err){
	// try something smart here too
	}
	var biteStamp = 0;
	var speedCheck = setInterval(function () {
		var speed = Math.round((socket.bytesWritten - biteStamp) / 1024);
		process.send({
			type: 'progressUpdate',
			speed: speed,
			bytesWritten: socket.bytesWritten
		});
		biteStamp = socket.bytesWritten;
	}, 1000);

	rs.on('end', function () {
		process.send({
			type: 'workerExit',
			bytesWritten: socket.bytesWritten
		});
		clearInterval(speedCheck);
		socket.destroy();
		process.exit();
	});
	
}).listen(9090, function () {
	process.send({
		type: 'serverReady'
	});
});