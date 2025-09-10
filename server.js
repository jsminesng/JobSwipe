const express = require("express");
const path = require("path");
const jobsHandler = require("./api/jobs.js");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static("."));

// API route
app.get("/api/jobs", jobsHandler);

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 Open your browser and navigate to the URL above`);
});
