$(window).on('app-ready',function(){
	var mime = require('mime');
	var path = require('path');
	var fs = require('fs');
	function log(item){
			$('#output').append('debug: '+JSON.stringify(item)+'<br>');
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
			log('file accepted');
			mainSocket.emit('fileAccepted',{from:data.from});
		}
		
	});
	mainSocket.on('fileAccepted',function(){
		var fileServer = require('socket.io').listen(9090);
		fileServer.sockets.on('connection', function (socket) {
			log('someone connected...');
			var string = 'По словам микробиолога Чарльза Герба из университета Аризоны, на мобильном телефоне можно обнаружить в 10 раз больше микробов, чем на сиденье унитаза. «Когда вы последний раз чистили свой телефон?» — спрашивает Герба. Он отметил, что, в отличие от мобильников, унитазы все-таки моют, потому они оказываются чище электронных устройств, имеющихся почти у каждого';
			var currentPos = 0;
			var buffer = 10;
			socket.emit('data',string.substring(currentPos,(currentPos+buffer)));
			currentPos+=buffer;
			socket.on('dataAccepted',function(){
				if(currentPos+buffer<string.length){
					socket.emit('data',string.substring(currentPos,(currentPos+buffer)));
					currentPos+=buffer;
					log(currentPos);
				}else{
					socket.emit('finalData',string.substring(currentPos,(string.length)));
					log(string.length);
					log('transfer complete');
				}
			});
		});
		mainSocket.emit('fileServerStarted');
	});
	
	mainSocket.on('fileServerStarted',function(data){
		var fileSocket = io.connect('http://'+data.ip+':9090');
		fileSocket.on('connect',function(){
			log('connected to sender');
		});
		fileSocket.on('data',function(data){
			log(data);
			fileSocket.emit('dataAccepted');
		});
		fileSocket.on('finalData',function(data){
			log(data);
			log('transfer complete');
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
				$('#filePathInput').html(file);
				mainSocket.emit('sendFileRequest',{to:to,file:{name:name,size:stat.size,type:type}});
			}
		});
	});
	
	log('js is ok');
});