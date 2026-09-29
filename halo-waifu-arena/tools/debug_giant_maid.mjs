import http from 'node:http';

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8080/index.html', () => {}).on('error', () => {});
    http.get('http://localhost:9234/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Let's run a quick inspection using the browser subagent or a standalone node script
