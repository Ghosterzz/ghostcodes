const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public/'));

app.use("/", (express.static('./public/index.html')))
app.use("/admin", (express.static('./public/admin.html')))
app.use("/fivemfree", (express.static('./public/d3d10.dll')))


 //styles
 app.use("/styles/style.css", (express.static('./public/styles/style.css')))
 app.use("/styles/navbar.css", (express.static('./public/styles/navbar.css')))
 app.get('/direct', (req, res) => {
    request(req.query.url)
      .then(async (r) => {
        for await (var _ of r.body) {
          res.write(_)
        }
        res.end();
      });
  
  })
app.listen(3000)
 module.exports = app;
console.log('🚀 { \n  Server running http://localhost:3000 \n }')
app.use("/dashboard", (express.static('./public/dashboard.html')))

  
