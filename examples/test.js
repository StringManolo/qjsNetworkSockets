// TCP Server
import sockets from '../dist/network_sockets.so';

const serverFd = sockets.socket(sockets.AF_INET, sockets.SOCK_STREAM, 0);
sockets.setsockopt(serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);
sockets.bind(serverFd, "0.0.0.0", 8080);
sockets.listen(serverFd, 5);

const client = sockets.accept(serverFd);
console.log(`Client connected from ${client.address}:${client.port}`);

const data = sockets.recv(client.fd, 1024, 0);
console.log("Received:", data);

sockets.send(client.fd, "HTTP/1.1 200 OK\r\n\r\nHello!", 0);
sockets.close(client.fd);
sockets.close(serverFd);
