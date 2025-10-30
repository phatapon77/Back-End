const express = require('express')
const app = express()
const port = 3000

// API WEB SERVICE STATUS
app.get('/', (req, res) => {
  res.send('สวัดดีผมชื่อหนึ่ง')
})

// API USERS MANAGMENT
app.get('/users', (req, res) => {
  res.send(req.params)
})

app.get('/users/:id', (req, res) => {
  res.send(req.params)
})

app.post('/users', (req, res) => {
  res.send('POST USERS DATA')
})

app.put('/users', (req, res) => {
  res.send('PUT USERS DATA')
})

app.delete('/users/:id', (req, res) => {
  res.send(req.params)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})