var named = require('./lib/index');
var server = named.createServer();
var ttl = 300;
var rebind = {};

server.listen(53, '127.0.0.1', function() {
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
		var record = new named.ARecord('127.0.0.1');
		query.addAnswer(domain, record, ttl);
		server.send(query);		
	}
});