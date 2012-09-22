var io = require('socket.io').listen(9000);
var clients = {};

io.sockets.on('connection', function (socket) {	
	socket.on('setLogin',function(login){
		clients[socket.id] = {};
		clients[socket.id].login = login;
		console.log(socket.id+' login is: '+login);
		var online=[];
		for(var client in clients){
			if(clients[client].login!=login){
				online.push(clients[client].login);
			}else continue;
		}
		socket.emit('onlinePush',online);
		socket.broadcast.emit('userJoined',{login:login});
	});
	
	socket.on('sendFileRequest',function(data){
		var from = clients[socket.id].login;
		var to = data.to;
		var sockets = io.sockets.clients();
		console.log(from,' => ',to);
		for(var i = 0;i<sockets.length;i++){
			if (clients[sockets[i].id].login === to){
				sockets[i].emit('sendFileRequest',{from:from,file:data.file});
				break;
			}
		}
	});
	
	socket.on('fileAccepted',function(data){//socket is reciver
		console.log('file from '+data.from+' accepted');
		var reciver = socket;
		var sockets = io.sockets.clients();
		for(var i = 0;i<sockets.length;i++){
			if (clients[sockets[i].id].login === data.from){
				var sender = sockets[i];
				clients[reciver.id].sender = sender;
				clients[sender.id].reciver = reciver;
				sender.emit('fileAccepted');
				break;
			}
		}
	});
	
	socket.on('message',function(data){
		io.sockets.emit('message',data);
	})
	
	socket.on('fileServerStarted',function(){//socket is sender
		var address = socket.handshake.address.address;
		clients[socket.id].reciver.emit('fileServerStarted',{ip:address});
	});
	
	socket.on('disconnect',function(){
		if(clients[socket.id]){
			var login = clients[socket.id].login;
			console.log(login+' disconnected');
			socket.broadcast.emit('userLeaved',{login:login});
			delete clients[socket.id];
		}
	});
});

io.set('log level', 2);
console.log('Server is running...');