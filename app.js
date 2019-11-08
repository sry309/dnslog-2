var named = require('./lib/index');
var server = named.createServer();
var ttl = 300;

server.listen(53, '127.0.0.1', function() {
  console.log('DNS server started on port 53');
});

server.on('query', function(query) {
  var domain = query.name();
  console.log('DNS Query: %s', domain)
  var record = new named.ARecord('127.0.0.1');
  query.addAnswer(domain, record, ttl);
  server.send(query);
});