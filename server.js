console.log("SERVER STARTED 🚀");

try {
  const app = require('./src/app');
  console.log("APP LOADED ✅");

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));

} catch (err) {
  console.error("CRASH ERROR ❌:", err);
}