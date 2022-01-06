const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public'));

app.use("/discord", (express.static('./public/discord.html')))
 app.use("/home", (express.static('./public/home.html')))
 app.use("/about", (express.static('./public/about.html')))
app.listen()
console.log('Server running https://ghostcodes.xyz')

module.exports = app;