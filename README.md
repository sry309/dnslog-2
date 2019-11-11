# DNSLOG

## deploy

install nodejs and npm
https://nodejs.org/en/download/

```
git clone https://github.com/hackit-me/dnslog
cd dnslog
npm install
# do change to domain in app.js
node app.js
```

set dns record
`set ns record to your webserver`

|subdomain|type|value|
|---|---|---|
|l.dnslog.io|ns|dnslog.io|