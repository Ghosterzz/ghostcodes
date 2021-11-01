const express = require('express')
const app = express()
 

app.use(express.static(__dirname + '/public'));


 app.get("/discord", (req, res) => {

    res.status(301).redirect("https://discord.gg/kPBufSFmuJ")

})
app.listen(3000)
console.log('Server running https://localhost:3000')

module.exports = app;