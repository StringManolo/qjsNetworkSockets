# qjsNetworkSockets

Native socket module for QuickJS with an optional Express-like HTTP framework. Build lightweight, embeddable network applications in pure JavaScript with direct access to BSD sockets.

---

## Features

- **Low-level Socket API**: Direct bindings to POSIX socket operations
- **Zero Dependencies**: Pure C module + vanilla QuickJS (no Node.js required)
- **Express-like Framework**: High-level HTTP server with routing, middleware, and request parsing
- **Minimal Footprint**: Compiled `.so` is ~15KB; entire stack fits in embedded environments
- **High Performance**: Epoll-based event loop handles 10K+ concurrent connections efficiently

---

## Performance

The async implementation with epoll achieves **~417 req/s** compared to Node.js Express at **~280 req/s** (49% faster) in standard benchmarks. The synchronous blocking version runs at ~356 req/s.

**[View full benchmarks →](tests/benchmarks/AB.md)**

Quick comparison (10K requests, 100 concurrent):
- **Async qjsNetworkSockets**: 417 req/s, 239ms avg latency
- **Node.js Express**: 280 req/s, 357ms avg latency
- **Sync qjsNetworkSockets**: 356 req/s, 280ms avg latency

---

## Quick Start

### Compilation

```bash
# Clone and compile (requires gcc and curl)
./compileSockets.sh
```

The script automatically downloads QuickJS headers and builds `dist/network_sockets.so`.

### Low-Level TCP Server

```javascript
import sockets from './dist/network_sockets.so';

const serverFd = sockets.socket(sockets.AF_INET, sockets.SOCK_STREAM, 0);
sockets.setsockopt(serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);
sockets.bind(serverFd, "0.0.0.0", 8080);
sockets.listen(serverFd, 5);

const client = sockets.accept(serverFd);
console.log(`Client connected from ${client.address}:${client.port}`);

const data = sockets.recv(client.fd, 1024, 0);
sockets.send(client.fd, "HTTP/1.1 200 OK\r\n\r\nHello!", 0);

sockets.close(client.fd);
sockets.close(serverFd);
```

### Express-like HTTP Server (Async with Epoll)

```javascript
import express from './extra/express.js';

const app = express();

// Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// REST API with route parameters
app.get('/api/users/:id', (req, res) => {
  const user = db.users.find(u => u.id == req.params.id);
  res.json(user || { error: 'Not found' }, 404);
});

app.post('/api/users', (req, res) => {
  const newUser = { id: Date.now(), ...req.body };
  db.users.push(newUser);
  res.status(201).json(newUser);
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Server running on port 8080');
});
```

---

## API Reference

### Low-Level Socket Module (`network_sockets.so`)

#### Constants
```javascript
sockets.AF_INET        // IPv4
sockets.AF_INET6       // IPv6 (not yet implemented)
sockets.SOCK_STREAM    // TCP
sockets.SOCK_DGRAM     // UDP
sockets.SOCK_RAW       // Raw sockets
sockets.IPPROTO_TCP
sockets.IPPROTO_UDP
sockets.SOL_SOCKET
sockets.SO_REUSEADDR
sockets.SO_KEEPALIVE
sockets.TCP_NODELAY
sockets.SHUT_RD / SHUT_WR / SHUT_RDWR

// Epoll constants
sockets.EPOLLIN
sockets.EPOLLOUT
sockets.EPOLLERR
sockets.EPOLLHUP
sockets.EPOLLET        // Edge-triggered mode
sockets.EPOLLONESHOT
sockets.EPOLL_CTL_ADD
sockets.EPOLL_CTL_MOD
sockets.EPOLL_CTL_DEL
```

#### Functions

**`socket(domain, type, protocol) → fd`**
Creates a new socket. Returns file descriptor or throws on error.

**`bind(fd, address, port) → 0`**
Binds socket to address/port. Use `"0.0.0.0"` or `""` for all interfaces.

**`listen(fd, backlog) → 0`**
Marks socket as passive for accepting connections.

**`accept(fd) → {fd, address, port} | null`**
Accepts incoming connection. Returns client object or null if no connection available (non-blocking).

**`connect(fd, address, port) → 0`**
Connects to remote server.

**`send(fd, data, flags) → bytes_sent`**
Sends string data. Returns bytes sent or throws.

**`recv(fd, bufsize, flags) → string`**
Receives up to `bufsize` bytes. Returns string (may be binary data).

**`close(fd) → 0`**
Closes socket descriptor.

**`setsockopt(fd, level, optname, optval) → 0`**
Sets socket options (integer values only).

**`shutdown(fd, how) → 0`**
Shuts down read/write halves.

**`gethostbyname(hostname) → address`**
Resolves hostname to IPv4 string.

**`setnonblocking(fd) → 0`**
Sets socket to non-blocking mode.

**`epoll_create1(flags) → epfd`**
Creates an epoll instance.

**`epoll_ctl(epfd, op, fd, events) → 0`**
Controls epoll instance (add/modify/delete file descriptors).

**`epoll_wait(epfd, maxevents, timeout) → [{fd, events}, ...]`**
Waits for events on the epoll instance. Returns array of event objects.

---

### Express-like Framework (`extra/express.js`)

#### `express() → app`

Creates application instance (extends Router).

#### `app.listen(port, host='0.0.0.0', callback)`
Starts asynchronous server loop with epoll. Execution blocks here.

#### `app.use([path], middleware)`
Registers middleware function `(req, res, next) => {}`.

#### Route Handlers

```javascript
app.get(path, handler)
app.post(path, handler)
app.put(path, handler)
app.delete(path, handler)
app.patch(path, handler)
app.all(path, handler)  // All methods
```

**Path parameters**: `/users/:id` → `req.params.id`

#### Request Object
```javascript
req.method       // "GET", "POST", etc.
req.path         // URL path
req.url          // Full URL
req.query        // {key: value} from query string
req.headers      // Lowercase header map
req.body         // Raw body string
req.params       // Route parameters
req.get(header)  // Case-insensitive header access
```

#### Response Object
```javascript
res.status(code)                    // Chainable
res.set(key, value)                 // Chainable
res.send(data)                      // Sends string/object
res.json(obj)                       // JSON with correct Content-Type
res.html(html)                      // HTML response
res.text(text)                      // Plain text
```

---

## Project Structure

```
qjsNetworkSockets/
├── compileSockets.sh      # Build script
├── src/qjs_sockets.c      # Native C module with epoll
├── extra/express.js       # Express-like framework (async)
├── examples/
│   ├── test.js           # Low-level TCP example
│   └── testExpress.js    # Full REST API example
├── dist/
│   └── network_sockets.so  # Compiled module
└── tests/
    └── benchmarks/
        └── AB.md         # Apache Bench performance tests
```

---

## Requirements

- **QuickJS** (header files auto-downloaded)
- **GCC** with C99 support
- **Linux** (or POSIX-compliant system with epoll)
- **~5MB** disk space for build artifacts

---

## Advanced Usage

### Epoll Event Loop

The Express framework uses epoll with edge-triggered mode for efficient I/O multiplexing:

```javascript
// Automatic in express.js, but you can use low-level API:
const epfd = sockets.epoll_create1(0);
sockets.epoll_ctl(epfd, sockets.EPOLL_CTL_ADD, fd, sockets.EPOLLIN);

const events = sockets.epoll_wait(epfd, 256, 1000); // timeout in ms
for (const event of events) {
  console.log(`Event on fd ${event.fd}: ${event.events}`);
}
```

### HTTPS/TLS

Not implemented. Use NGINX/HAProxy as reverse proxy or add OpenSSL bindings.

### WebSocket Support

Possible using `socket.SOCK_STREAM` and manual protocol upgrade handling. Consider extending `express.js` with `ws` middleware.

### Error Handling

All socket operations throw `InternalError` on failure. Wrap in `try/catch`:

```javascript
try {
  const client = sockets.accept(serverFd);
} catch (e) {
  console.error('Accept failed:', e.message);
}
```

---

## Limitations & Roadmap

### Current Limitations
- IPv6 not implemented (C code uses `sockaddr_in` only)
- No streaming/chunked response support (`res.send()` buffers everything)
- Binary data handling is string-based
- Single-threaded event loop (no multi-threading)
- No built-in static file serving
- Linux-only (epoll is not available on macOS/BSD)

### Planned Improvements
- [ ] IPv6 support (`sockaddr_in6`)
- [ ] Chunked encoding for large responses
- [ ] `Uint8Array` binary support in `send()`/`recv()`
- [ ] kqueue support for macOS/BSD
- [ ] HTTPS via mbedtls or BearSSL
- [ ] TypeScript definitions
- [ ] Comprehensive test suite

---

## License

MIT License - see `LICENSE` file.

---

## Contributing

This is a high-performance proof-of-concept. For production use, consider:
- Adding proper buffering for incomplete HTTP packets
- Implementing connection pooling
- Creating Docker examples for embedded deployment
- Adding benchmarking suite for regression testing

Pull requests are welcome.
