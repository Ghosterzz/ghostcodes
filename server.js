const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public/Pages'));

app.use("/discord", (express.static('./public/redirects/discord.html')))
 app.use("/home", (express.static('./public/Pages/home.html')))
 app.use("/about", (express.static('./public/Pages/about.html')))
 app.use("/login", (express.static('./public/Pages/login.html')))
 app.use("/register", (express.static('./public/Pages/register.html')))

 //styles
 app.use("/styles/style.css", (express.static('./public/styles/style.css')))
 app.use("/styles/navbar.css", (express.static('./public/styles/navbar.css')))
 
app.listen(3000)

console.log('🚀 { \n  Server running http://localhost:3000 \n }')