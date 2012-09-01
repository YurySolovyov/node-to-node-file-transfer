$(window).on('app-ready',function(){
	var mime = require('mime');
	var path = require('path');
	var fs = require('fs');
	var Buffer = require('buffer').Buffer;
	var crypto = require('crypto');
	var net = require('net');
	function log(item){
			$('#output').append('debug: '+JSON.stringify(item)+'<br>');
	}
	
	function updateProgress(bytesWritten,fileSize){
		var percent = Math.round((bytesWritten/fileSize)*100);
		$('#progress').children('#bar').css('width',percent+'%');
	}
	
	var mainSocket = io.connect('http://localhost:9000');
	
	mainSocket.on('connect',function(){
		log('main socket connection established');
	});
	
	mainSocket.on('error',function(){
		log('FAILED TO CONNECT TO MAIN SERVER');
	});
	
	mainSocket.on('sendFileRequest',function(data){
		var isAccepted = confirm('from: '+data.from+'\nname: '+data.file.name+'\nsize: '+data.file.size+'\ntype: '+data.file.type);
		if(isAccepted){
			window.frame.openDialog({
					type:'save',
					acceptTypes: { all:['*.*'] },
					initialValue:data.file.name,
					multiSelect:false,
					dirSelect:false
					},function(err,file){
						if(!err){
							$('#filePathInput').text(file);
							$('#filePathInput').data('fileSize',data.file.size);
							log('file accepted');
							mainSocket.emit('fileAccepted',{from:data.from});
						}
			});
		}
	});
	mainSocket.on('fileAccepted',function(){
		var server = net.createServer(function (socket) {
		log('someone connected...');
			var bytesSent = 0;
			var bufferSize = 64*1024;
			var filePath = path.resolve($('#filePathInput').html());
			var fileSize = fs.statSync(filePath).size;
			var rs = fs.createReadStream(filePath, { bufferSize: bufferSize, encoding: 'binary'});
			rs.on('data',function(data){
				socket.write(data,'binary');
				bytesSent+=data.length;
				updateProgress(bytesSent,fileSize)
			});
			rs.on('end',function(){
				socket.end();
			});
			
		}).listen(9090);
		mainSocket.emit('fileServerStarted');
	});
	
	mainSocket.on('fileServerStarted',function(data){
		var fileSocket = net.createConnection(9090, data.ip);
		var filePath = path.resolve($('#filePathInput').html());
		var fileSize = $('#filePathInput').data('fileSize');
		var bytesRecived = 0;
		var ws = fs.createWriteStream(filePath,{encoding: 'binary' });
		
		fileSocket.on('connect',function(){
			log('connected to sender');
		});
		
		fileSocket.on('data',function(data){
			ws.write(data,'binary');
			bytesRecived+=data.length;
			updateProgress(bytesRecived,fileSize);
		});
		
		fileSocket.on('end',function(){
			log('transfer complete');
			ws.end();
			fileSocket.end();
		});
	});
	
	$('#loginSubmit').click(function(){
		var random  = Math.round(Math.random(1000)*1000);
		var login = $('#loginField').val()+random;
		$('#loginField').add('#loginSubmit').hide();
		$('#userRequestField').add('#fileSelector').show();
		mainSocket.emit('setLogin',login);
		$('#loginHeader').html(login);
	});
	

	$('#fileSelector').click(function(){
		 window.frame.openDialog({
			type:'open',
			acceptTypes: { all:['*.*'] },
			multiSelect:false,
			dirSelect:false
		},function(err,files){
			if(!err){
				var file = files[0];
				var type = mime.lookup(file);
				var stat = fs.statSync(file);
				var name = path.basename(file);
				var to = $('#userRequestField').val();
				$('#filePathInput').html(file);
				log({name:name,size:stat.size,type:type});
				mainSocket.emit('sendFileRequest',{to:to,file:{name:name,size:stat.size,type:type}});
			}
		});
	});
	
	log('js is ok');
});