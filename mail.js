const net = require('net')
const assert = require('assert')
const config = require('./config')

const host = config.mail.host,
      port = config.mail.port,
      user = config.mail.user,
      pass = config.mail.pass

function sendmailbysmtp(mail,subject,msg){
    var   to = mail;
    function getData() {
        return new Promise((resolve,reject) => {
            next()
            function next(){
                if(data) {
                    let temp = data
                    data =null
                    resolve(temp)
                } else {
                    setTimeout(next,0)
                }
            }
        })
    }

    function sendData(msg) {
        //console.log('发送：'+msg)
        client.write(msg+'\r\n')
    }
    let client = net.createConnection({host,port},async() => {
        //console.log('连接上了')
        let code
        code = await getData()
        assert(code == 220)
        // 打招呼
        sendData('HELO ' + host)

        code = await getData()
        assert(code == 250)
        // 要登陆
        sendData('auth login')

        code = await getData()
        assert(code == 334)
        // 给用户名（邮箱）---base64编码
        sendData(new Buffer(user).toString('base64'))

        code = await getData()
        assert(code == 334)
        // 给密码---base64编码
        sendData(new Buffer(pass).toString('base64'))

        code = await getData()
        assert(code == 235)
        // 给用户名（邮箱
        sendData(`MAIL FROM:<${user}>`)

        code = await getData()
        assert(code == 250)
        // 给目标邮箱
        sendData(`RCPT TO:<${to}>`)

        code = await getData()
        assert(code == 250)
        // 要发送数据
        sendData('DATA')

        code = await getData()
        assert(code == 354)
        // 发主题
        sendData(`SUBJECT:${subject}`)
        // 发发件人
        sendData(`FROM:${user}`)    
        // 发目标
        sendData(`TO:${to}\r\n`)
        sendData(`${msg}\r\n.`)

        code = await getData()
        sendData(`QUIT`)
        
    })

    let data = null
    client.on('data', d => {
        //console.log('接受到：'+d.toString())
        data = d.toString().substring(0,3)
    })
    client.on('end', () => {
        //console.log('连接断开')
    })
}

module.exports = {
    send : sendmailbysmtp
}