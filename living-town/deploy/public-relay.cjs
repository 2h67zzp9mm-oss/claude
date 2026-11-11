// Local TCP relay for Little Town's public HTTPS Funnel, including WebSockets.
const net = require('node:net');
const server = net.createServer(client => {
  const upstream = net.connect(4310, '100.66.214.35');
  client.pipe(upstream).pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
});
server.listen(4312, '127.0.0.1');
