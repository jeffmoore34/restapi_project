const express = require('express');
const app = express();
const port = 3000;

// Define a basic route
app.get('/', (req, res) => {
    res.send('Hello, World! This is my Express server.');
  });

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

