const express = require('express')
const app = express()
 const path = require('path')

app.use(express.static(__dirname + '/public'));


 app.get("/discord", (req, res) => {
res.status(301).redirect("https://discord.gg/gTmh5TcEwR")
})
 app.use("/home", (express.static('./public/home.html')))
 app.use("/about", (express.static('./public/about.html')))
app.listen()
console.log('Server running https://ghostcodes.xyz')

module.exports = app;