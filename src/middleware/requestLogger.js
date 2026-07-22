const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1000000;

    let color = "\x1b[32m"; // Green

    if (time > 300) color = "\x1b[33m"; // Yellow

    if (time > 1000) color = "\x1b[31m"; // Red

    console.log(
      `${color}${req.method} ${req.originalUrl} | ${res.statusCode} | ${time.toFixed(2)} ms\x1b[0m`,
    );
  });

  next();
};

module.exports = requestLogger;
