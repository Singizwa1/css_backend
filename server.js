const app = require('./src/app');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

app.get('/',(req, res)=>{
  res.send('Well come to Serge\'s server');
})
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});