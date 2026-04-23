/**
 * Simple concurrency limiter (like p-limit) — zero dependencies.
 * Prevents one heavy extraction from freezing the server by
 * limiting how many yt-dlp processes run simultaneously.
 *
 * ENV:
 *   MAX_CONCURRENT — max parallel extractions (default: 3)
 */

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT, 10) || 3;

let activeCount = 0;
const queue = [];

function run(fn) {
  return new Promise((resolve, reject) => {
    const execute = () => {
      activeCount++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeCount--;
          if (queue.length > 0) {
            const next = queue.shift();
            next();
          }
        });
    };

    if (activeCount < MAX_CONCURRENT) {
      execute();
    } else {
      queue.push(execute);
    }
  });
}

function pending() {
  return queue.length;
}

function active() {
  return activeCount;
}

module.exports = { run, pending, active, MAX_CONCURRENT };
