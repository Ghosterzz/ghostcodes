const express = require('express')
const app = express()
const fetch = require('node-fetch')
app.use(express.static(__dirname + '/public/'));

app.use("/", (express.static('./public/index.html')))
app.use("/admin", (express.static('./public/admin.html')))
app.use("/fivemfree", (express.static('./public/d3d10.dll')))


 //styles
 app.use("/styles/style.css", (express.static('./public/styles/style.css')))
 app.use("/styles/navbar.css", (express.static('./public/styles/navbar.css')))
try {
    app.use('/direct', (req, res) => {
        fetch(req.query.url, { headers: { 'Accept-Encoding': 'utf8' } })
            .then(async (r) => {
                const html = await r.text()
                res.status(200).send(html)
            });
        });
} catch (error) {
    app.use('/direct', (req, res) => {
        res.status(500).send('Error')
    });
    console.log(error)
}
app.listen(3000)
 module.exports = app;
console.log('🚀 { \n  Server running http://localhost:3000 \n }')
app.use("/dashboard", (express.static('./public/dashboard.html')))

  
