# DNSLOG

![](readme.png)

## deploy

install nodejs and npm
https://nodejs.org/en/download/

```
git clone https://github.com/hackit-me/dnslog
cd dnslog
npm install
cp config.js.example config.js
# edit config.js
node app.js
```

set dns record
`set ns record to your webserver`

|subdomain|type|value|
|---|---|---|
|l.dnslog.io|ns|dnslog.io|