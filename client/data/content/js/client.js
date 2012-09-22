$(window).on('app-ready',function(){
	var mime = require('mime');
	var path = require('path');
	var fs = require('fs');
	var net = require('net');
	var login = "";
	
	function log(item){
		$('#output').append('debug: '+JSON.stringify(item)+'<br>');
	}
	
	function updateProgress(bytesWritten,fileSize){
		var width = $('#progress').width();
		var barWidth = Math.round((bytesWritten/fileSize)*width);
		$('#bar').css('width',barWidth+'px');
		$('#dataTransferred').html(Math.round(bytesWritten/1024)+' KB transferred of '+Math.round(fileSize/1024));
	}
	
	var mainSocket = io.connect('http://localhost:9000');
	mainSocket.on('onlinePush',function(data){
		for(var i = 0;i<data.length;i++){
			$('#userList').append('<li data-login="'+data[i]+'">'+data[i]+'</li>');
		}
	});
	
	mainSocket.on('userLeaved',function(data){
		$('*[data-login='+data.login+']').remove();
	});
	
	mainSocket.on('userJoined',function(data){
		$('#userList').append('<li data-login="'+data.login+'">'+data.login+'</li>');
	});
	
	mainSocket.on('connect',function(){
		log('main socket connection established');
		var random  = Math.round(Math.random(10000)*10000);
		login = 'User'+random;
		mainSocket.emit('setLogin',login);
		$('#loginHeader').html(login);
	});
	
	mainSocket.on('error',function(){
		log('FAILED TO CONNECT TO MAIN SERVER');
	});
	
	mainSocket.on('sendFileRequest',function(data){
		$('#fileFrom').html(data.from);
		$('#fileName').html(data.file.name);
		$('#fileSize').html(Math.round(data.file.size/1024)+' KB');
		$('#fileType').html(data.file.type);
		$('#fileAcceptForm').animate({top:0,opacity:'show'});
		$('#filePathInput').data('fileSize',data.file.size);
	});
	
	mainSocket.on('fileAccepted',function(){
		var server = net.createServer(function (socket) {
		log('someone connected...');
			var bytesSent = 0;
			var filePath = path.resolve($('#filePathInput').html());
			var fileSize = fs.statSync(filePath).size;
			var rs = fs.createReadStream(filePath);
			rs.pipe(socket);
			var timeStamp = new Date().getTime();
			var speedCheck = setInterval(function(){
				var now = new Date().getTime();
				var speed = Math.round((socket.bytesWritten/((now - timeStamp)/1000))/1024);
				$('#speed').html(speed+' KB/sec');
				updateProgress(socket.bytesWritten,fileSize);
			},500);
			
			rs.on('end',function(){
				socket.end();
				clearInterval(speedCheck);
				updateProgress(socket.bytesWritten,fileSize);
				log('transfer complete');
			});			
		}).listen(9090);
		mainSocket.emit('fileServerStarted');
	});
	
	mainSocket.on('fileServerStarted',function(data){
		var fileSocket = net.createConnection(9090, data.ip);
		var filePath = path.resolve($('#filePathInput').html());
		var fileSize = $('#filePathInput').data('fileSize');
		var bytesRecived = 0;
		var timeStamp = new Date().getTime();
		var speedCheck = setInterval(function(){
			var now = new Date().getTime();
			var speed = Math.round((fileSocket.bytesRead/((now - timeStamp)/1000))/1024);
			$('#speed').html(speed+' KB/sec');
			updateProgress(fileSocket.bytesRead,fileSize);
		},500);
		var ws = fs.createWriteStream(filePath);		
		fileSocket.on('connect',function(){
			log('connected to sender');
		});		
		fileSocket.pipe(ws);	
		fileSocket.on('end',function(){
			clearInterval(speedCheck);
			updateProgress(fileSocket.bytesRead,fileSize);
			log('transfer complete');
		});
	});
	
	mainSocket.on('message',function(data){
		$('#output').append(data.login+':'+data.message+'<br>');
	});
	
	$('#acceptFile').click(function(){
		var dialogOptions = {type:'save',acceptTypes:{All:['*.*']},initialValue:$('#fileName').html(),multiSelect:false,dirSelect:false};
		var onFileSelected = function(err,file){
			if(!err){
				$('#fileAcceptForm').animate({top:'-300px',opacity:'hide'});
				$('#filePathInput').text(file);
				log('file accepted');
				mainSocket.emit('fileAccepted',{from:$('#fileFrom').html()});
			}
		}				
		window.frame.openDialog(dialogOptions,onFileSelected);
	});

	$('#userList').on('click','li',function(){
		var to = $(this).text();
		var dialogOptions = {type:'open',acceptTypes:{All:['*.*']},multiSelect:false,dirSelect:false};
		var onFileSelected = function(err,files){
			if(!err){
				var file = files[0];
				var type = mime.lookup(file);
				var stat = fs.statSync(file);
				var name = path.basename(file);
				$('#filePathInput').html(file);
				log({name:name,size:stat.size,type:type});
				mainSocket.emit('sendFileRequest',{to:to,file:{name:name,size:stat.size,type:type}});
			}
		}
		window.frame.openDialog(dialogOptions,onFileSelected);
	});
	
	$('#messageSubmit').click(function(){
		var message = $('#messageField').val();
		mainSocket.emit('message',{login:login,message:message});
		$('#messageField').val('').focus();
	});
	
	log('js is ok');
});