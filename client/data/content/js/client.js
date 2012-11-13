$(window).on('app-ready',function(){
	var mime = require('mime');
	var path = require('path');
	var fs = require('fs');
	var net = require('net');
	var child_process = require('child_process');
	var login = "";
	
	function log(item){
		$('#output').append('debug: '+JSON.stringify(item)+'<br>');
	}
	
	function updateProgress(bytesWritten,fileSize,speed){
		var width = $('#progress').width();
		var barWidth = Math.round((bytesWritten/fileSize)*width);
		$('#bar').css('width',barWidth+'px');
		$('#dataTransferred').html(Math.round(bytesWritten/1024)+' KB transferred of '+Math.round(fileSize/1024));
		if(speed){
			$('#speed').html(speed+' KB/sec');
		}
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
		var filePath = path.resolve($('#filePathInput').html());
		var fileSize = fs.statSync(filePath).size;
		var fileServer = child_process.fork(__dirname+'\\content\\js\\workers\\fileServer.js',{env:{filePath:filePath},silent:true});
		fileServer.on('message',function(message){
			if(message.type === 'serverReady'){
				mainSocket.emit('fileServerStarted');
				log('fileServerStarted');
			}else if(message.type === 'progressUpdate'){
				updateProgress(message.bytesWritten,fileSize,message.speed);
			}else if(message.type === 'workerExit'){
				updateProgress(message.bytesWritten,fileSize);
				log('transfer complete');
			}
		});
		fileServer.on('exit',function(){
			log('child exited'+(new Date().getTime()));
		});
		fileServer.stderr.on('data',function(data){
			console.log(data.toString());
			log('error in child');
		});
		$('#cancelTransfer').click(function(){
			$(this).attr('disabled','disabled');
			fileServer.kill();
			log('cancelTransfer event');
		});
	});
	
	mainSocket.on('fileServerStarted',function(data){
		var filePath = path.resolve($('#filePathInput').html());
		var fileSize = parseInt($('#filePathInput').data('fileSize'));
		var fileSocket = child_process.fork(__dirname+'\\content\\js\\workers\\fileSocket.js',{env:{filePath:filePath,serverAddress:data.ip},silent:true});
		fileSocket.on('message',function(message){
			if(message.type === 'serverConnectionEstablished'){
				log('connected to sender');
			}else if(message.type === 'progressUpdate'){
				updateProgress(message.bytesRead,fileSize,message.speed);
			}else if(message.type === 'workerExit'){
				updateProgress(message.bytesRead,fileSize);
				log('transfer complete');
			}else if(message.type === 'error'){
				log(message.err);
			}
		});
		function cleanOnCancel(path){
			fs.unlink(path,function(err){
				if(!err){
					log('clean up done');
				}
			})
		}
		fileSocket.on('exit',function(){
			log('child exited'+(new Date().getTime()));
			if(fileSize > fs.statSync(filePath).size){
				cleanOnCancel(filePath);
			}
		});
		fileSocket.stderr.on('data',function(data){
			console.log(data.toString());
			log('error in child');
		});
		$('#cancelTransfer').click(function(){
			if(fileSocket){
				$(this).attr('disabled','disabled');
				fileSocket.kill();
				log('cancelTransfer event');
			}
		});
		
	});
	
	mainSocket.on('message',function(data){
		$('#output').append(data.login+':'+data.message+'<br>');
	});
	
	$('#acceptFile').click(function(){
		var dialogOptions = {
			type:'save',
			acceptTypes:{All:['*.*']},
			initialValue:$('#fileName').html(),
			multiSelect:false,
			dirSelect:false
		}
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
		var dialogOptions = {
			type:'open',
			acceptTypes:{All:['*.*']},
			multiSelect:false,
			dirSelect:false
		}
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