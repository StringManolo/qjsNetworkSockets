import sockets from '../dist/network_sockets.so';

class Request {
  constructor(parsedRequest, clientInfo) {
    this.clientInfo = clientInfo;
    
    this.method = parsedRequest.method || '';
    this.url = parsedRequest.url || '';
    this.path = parsedRequest.path || '';
    this.query = parsedRequest.query || {};
    this.headers = parsedRequest.headers || {};
    this.body = parsedRequest.body || '';
    this.httpVersion = parsedRequest.httpVersion || 'HTTP/1.1';
    this.params = {};
  }
  
  get(header) {
    return this.headers[header.toLowerCase()];
  }
}

class Response {
  constructor(clientFd) {
    this.clientFd = clientFd;
    this.statusCode = 200;
    this.headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Connection': 'close', // keep-alive is handled auto
      'Server': 'qjs-express/1.0'
    };
    this.sent = false;
    this._buffer = '';
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  set(key, value) {
    this.headers[key] = value;
    return this;
  }

  get(key) {
    return this.headers[key];
  }

  send(body) {
    if (this.sent) return this._buffer;
    
    let data = body;
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      data = JSON.stringify(body);
      if (!this.headers['Content-Type']) {
        this.headers['Content-Type'] = 'application/json; charset=utf-8';
      }
    } else if (typeof body === 'string') {
      data = body;
      if (!this.headers['Content-Type'] && !body.startsWith('<!DOCTYPE html>') && !body.startsWith('<html>')) {
        this.headers['Content-Type'] = 'text/plain; charset=utf-8';
      }
    } else {
      data = String(body);
    }
    
    let contentLength;
    if (typeof data === 'string') {
      // Simple byte length estimation for UTF-8
      contentLength = data.length;
      // Adjust for multi-byte characters (simple approach)
      for (let i = 0; i < data.length; i++) {
        const code = data.charCodeAt(i);
        if (code > 127) contentLength += 1; // Approximate extra bytes for non-ASCII
      }
    } else {
      contentLength = 0;
    }
    
    this.headers['Content-Length'] = contentLength;

    const statusMessages = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      413: 'Payload Too Large',
      415: 'Unsupported Media Type',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    
    const statusText = statusMessages[this.statusCode] || 'Unknown';
    let response = `HTTP/1.1 ${this.statusCode} ${statusText}\r\n`;
    
    if (!this.headers.Connection) {
      this.headers.Connection = 'close';
    }
    
    if (!this.headers.Date) {
      this.headers.Date = new Date().toUTCString();
    }
    
    for (const [key, value] of Object.entries(this.headers)) {
      response += `${key}: ${value}\r\n`;
    }

    response += '\r\n'; 
    
    if (this.statusCode !== 204 && this.statusCode !== 304 && data) {
      response += data;
    }
    
    this._buffer = response;
    this.sent = true;
    return this._buffer;
  }
  
  json(obj) {
    this.set('Content-Type', 'application/json; charset=utf-8');
    return this.send(obj);
  }

  html(html) {
    this.set('Content-Type', 'text/html; charset=utf-8');
    return this.send(html);
  }

  text(text) {
    this.set('Content-Type', 'text/plain; charset=utf-8');
    return this.send(text);
  }

  redirect(url, permanent = false) {
    this.status(permanent ? 301 : 302);
    this.set('Location', url);
    return this.send(`Redirecting to ${url}`);
  }

  sendStatus(statusCode) {
    const statusMessages = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error'
    };
    
    this.status(statusCode);
    const message = statusMessages[statusCode] || 'Unknown';
    return this.send(`${statusCode} ${message}`);
  }

  cookie(name, value, options = {}) {
    let cookieStr = `${name}=${encodeURIComponent(value)}`;
    
    if (options.path) cookieStr += `; Path=${options.path}`;
    if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
    if (options.domain) cookieStr += `; Domain=${options.domain}`;
    if (options.secure) cookieStr += '; Secure';
    if (options.httpOnly) cookieStr += '; HttpOnly';
    if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;
    
    if (!this.headers['Set-Cookie']) {
      this.headers['Set-Cookie'] = [];
    }
    
    if (Array.isArray(this.headers['Set-Cookie'])) {
      this.headers['Set-Cookie'].push(cookieStr);
    } else {
      this.headers['Set-Cookie'] = [this.headers['Set-Cookie'], cookieStr];
    }
    
    return this;
  }

  clearCookie(name, options = {}) {
    const opts = Object.assign({}, options, {
      expires: new Date(0)
    });
    return this.cookie(name, '', opts);
  }

  end() {
    if (!this.sent) {
      this.send('');
    }
    return this._buffer;
  }

  setNoCache() {
    this.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    this.set('Pragma', 'no-cache');
    this.set('Expires', '0');
    return this;
  }

  setCache(seconds = 3600) {
    this.set('Cache-Control', `public, max-age=${seconds}`);
    return this;
  }

  setCors(origin = '*') {
    this.set('Access-Control-Allow-Origin', origin);
    this.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    this.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    this.set('Access-Control-Allow-Credentials', 'true');
    return this;
  }

  debug() {
    console.log('Response:', {
      statusCode: this.statusCode,
      headers: this.headers,
      sent: this.sent,
      bufferLength: this._buffer ? this._buffer.length : 0
    });
    return this;
  }
}

class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }
  
  use(pathOrMiddleware, middleware) {
    if (typeof pathOrMiddleware === 'function') {
      this.middlewares.push({ path: null, handler: pathOrMiddleware });
    } else {
      this.middlewares.push({ path: pathOrMiddleware, handler: middleware });
    }
    return this;
  }
  
  _addRoute(method, path, handler) {
    this.routes.push({ method, path, handler });
    return this;
  }
  
  get(path, handler) {
    return this._addRoute('GET', path, handler);
  }
  
  post(path, handler) {
    return this._addRoute('POST', path, handler);
  }
  
  put(path, handler) {
    return this._addRoute('PUT', path, handler);
  }

  delete(path, handler) {
    return this._addRoute('DELETE', path, handler);
  }

  patch(path, handler) {
    return this._addRoute('PATCH', path, handler);
  }

  all(path, handler) {
    return this._addRoute('*', path, handler);
  }
  
  _matchRoute(method, path) {
    for (const route of this.routes) {
      if (route.method !== '*' && route.method !== method) continue;

      const params = this._matchPath(route.path, path);
      if (params !== null) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  _matchPath(pattern, path) {
    // Handle exact matches first
    if (pattern === path) {
      return {};
    }
    
    const paramNames = [];
    const regexPattern = pattern.replace(/:([a-zA-Z0-9_]+)/g, (match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const regex = new RegExp('^' + regexPattern + '$');
    const match = path.match(regex);

    if (!match) return null;
    
    const params = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    return params;
  }
  
  _handleRequest(req, res) {
    // Execute middlewares
    for (const mw of this.middlewares) {
      if (mw.path === null || req.path.startsWith(mw.path)) {
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        mw.handler(req, res, next);
        
        if (!nextCalled || res.sent) return;
      }
    }
    
    // Find matching route
    const match = this._matchRoute(req.method, req.path);
    
    if (match) {
      req.params = match.params;
      match.handler(req, res);
    } else {
      res.status(404).send('Not Found');
    }
  }
}

class Express extends Router {
  constructor() {
    super();
    this.serverFd = null;
    this.epollFd = null;
    this.clients = new Map();
    this.timeoutCheckInterval = 1000; 
    this.keepAliveTimeout = 5000; 
    this.lastTimeoutCheck = Date.now();
    this.running = true;
  }
  
  listen(port, host = '0.0.0.0', callback) {
    this.serverFd = sockets.socket(sockets.AF_INET, sockets.SOCK_STREAM, 0);
    
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEPORT, 1);
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_RCVBUF, 262144);
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_SNDBUF, 262144);

    sockets.bind(this.serverFd, host, port);
    sockets.listen(this.serverFd, 2048);
    sockets.setnonblocking(this.serverFd);

    this.epollFd = sockets.epoll_create1(0);

    sockets.epoll_ctl(
      this.epollFd,
      sockets.EPOLL_CTL_ADD,
      this.serverFd,
      sockets.EPOLLIN | sockets.EPOLLET
    );

    if (typeof callback === 'function') {
      callback();
    }

    console.log(`Server listening on ${host}:${port}`);

    while (this.running) {
      try {
        const events = sockets.epoll_wait(this.epollFd, 512, 10); // 10ms timeout
        
        this._checkTimeouts();
        
        for (const event of events) {
          if (event.fd === this.serverFd) {
            this._acceptConnections();
          } else {
            this._handleClientEvent(event);
          }
        }
      } catch (e) {
        // Ignore errors en epoll_wait
      }
    }
  }

  _acceptConnections() {
    while (true) {
      try {
        const client = sockets.accept(this.serverFd);
        if (!client) break;
        
        sockets.setnonblocking(client.fd);
        sockets.setsockopt(client.fd, sockets.IPPROTO_TCP, sockets.TCP_NODELAY, 1);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_KEEPALIVE, 1);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_RCVBUF, 65536);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_SNDBUF, 65536);

        sockets.epoll_ctl(
          this.epollFd,
          sockets.EPOLL_CTL_ADD,
          client.fd,
          sockets.EPOLLIN | sockets.EPOLLET | sockets.EPOLLRDHUP
        );

        this.clients.set(client.fd, {
          info: client,
          buffer: '',
          requestCount: 0,
          lastActivity: Date.now(),
          keepAlive: false,
          httpVersion: 'HTTP/1.1'
        });
        
      } catch (e) {
        break;
      }
    }
  }

  _handleClientEvent(event) {
    const clientData = this.clients.get(event.fd);
    if (!clientData) return;

    if (event.events & (sockets.EPOLLERR | sockets.EPOLLHUP | sockets.EPOLLRDHUP)) {
      this._closeClient(event.fd);
      return;
    }

    if (event.events & sockets.EPOLLIN) {
      this._handleRead(event.fd, clientData);
    }
  }

  _handleRead(fd, clientData) {
    try {
      let totalRead = 0;
      const maxReadPerCall = 65536;
      
      while (totalRead < maxReadPerCall) {
        const chunk = sockets.recv(fd, 8192, 0);
        
        if (!chunk || chunk.length === 0) {
          break;
        }
        
        clientData.buffer += chunk;
        totalRead += chunk.length;
        clientData.lastActivity = Date.now();
        
        if (clientData.buffer.length > 0) {
          this._processBuffer(fd, clientData);
          if (!this.clients.has(fd)) {
            return;
          }
        }
      }
    } catch (e) {
      this._closeClient(fd);
    }
  }

  _processBuffer(fd, clientData) {
    while (clientData.buffer.length > 0) {
      let headerEnd = clientData.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        headerEnd = clientData.buffer.indexOf('\n\n');
        if (headerEnd === -1) {
          return; 
        }
      }

      const headersPart = clientData.buffer.substring(0, headerEnd);
      
      let contentLength = 0;
      const contentLengthMatch = headersPart.match(/content-length:\s*(\d+)/i);
      if (contentLengthMatch) {
        contentLength = parseInt(contentLengthMatch[1], 10);
      }
      
      const headerDelimiterLength = clientData.buffer.includes('\r\n\r\n') ? 4 : 2;
      const totalLength = headerEnd + headerDelimiterLength + contentLength;
      
      if (clientData.buffer.length < totalLength) {
        return; 
      }

      const requestData = clientData.buffer.substring(0, totalLength);
      clientData.buffer = clientData.buffer.substring(totalLength);
      
      clientData.lastActivity = Date.now();

      try {
        const parsedRequest = sockets.parse_http_request(requestData);
        
        const req = new Request(parsedRequest, clientData.info);
        const res = new Response(fd);
        
        const httpVersion = parsedRequest.httpVersion || 'HTTP/1.1';
        const connectionHeader = parsedRequest.headers?.connection || '';
        
        // HTTP/1.1: keep-alive by default unless "close"
        // HTTP/1.0: close by default unless "keep-alive"
        let keepAlive = false;
        if (httpVersion === 'HTTP/1.1') {
          keepAlive = connectionHeader.toLowerCase() !== 'close';
        } else {
          keepAlive = connectionHeader.toLowerCase() === 'keep-alive';
        }
        
        if (keepAlive) {
          res.headers.Connection = 'keep-alive';
          res.headers['Keep-Alive'] = 'timeout=5, max=1000';
        } else {
          res.headers.Connection = 'close';
        }
        
        clientData.keepAlive = keepAlive;
        clientData.httpVersion = httpVersion;
        
        this._handleRequest(req, res);
        
        if (res.sent && res._buffer) {
          let sent = 0;
          const data = res._buffer;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (sent < data.length && attempts < maxAttempts) {
            try {
              const chunkToSend = data.slice(sent);
              const n = sockets.send(fd, chunkToSend, 0);
              
              if (n > 0) {
                sent += n;
                attempts = 0; // Reset attempts on successful send
                clientData.lastActivity = Date.now();
              } else if (n === 0) {
                // EAGAIN/EWOULDBLOCK - wait and retry
                attempts++;
                
                const start = Date.now();
                while (Date.now() - start < 2) {} // 2ms
                
                if (attempts >= maxAttempts) {
                  console.log(`Failed to send complete response to fd=${fd} after ${maxAttempts} attempts`);
                  this._closeClient(fd);
                  return;
                }
              } else {
                throw new Error('Send failed');
              }
            } catch (e) {
              console.log(`Error sending to fd=${fd}:`, e.message);
              this._closeClient(fd);
              return;
            }
          }
          
          if (sent < data.length) {
            console.log(`Partial send to fd=${fd}: sent ${sent}/${data.length} bytes`);
            this._closeClient(fd);
            return;
          }
          
          clientData.requestCount++;
          clientData.lastActivity = Date.now();
          
          const shouldClose = 
            !keepAlive || 
            connectionHeader.toLowerCase() === 'close' ||
            clientData.requestCount >= 1000;
          
          if (shouldClose) {
            this._closeClient(fd);
            return; 
          }
          
        } else {
          this._closeClient(fd);
          return;
        }
      } catch (e) {
        console.error('Error processing request on fd=' + fd + ':', e.message || e);
        
        try {
          const errorResponse = `HTTP/1.1 500 Internal Server Error\r\n` +
            `Content-Type: text/plain\r\n` +
            `Connection: close\r\n` +
            `Content-Length: 21\r\n\r\n` +
            `Internal Server Error`;
          
          sockets.send(fd, errorResponse, 0);
        } catch (sendError) {
          // Ignore send errors during error handling
        }
        
        this._closeClient(fd);
        return;
      }
    }
  }

  _checkTimeouts() {
    const now = Date.now();
    
    if (now - this.lastTimeoutCheck < this.timeoutCheckInterval) {
      return;
    }
    
    this.lastTimeoutCheck = now;
    
    const fdsToClose = [];
    
    for (const [fd, clientData] of this.clients.entries()) {
      const idleTime = now - clientData.lastActivity;
      
      if (clientData.keepAlive) {
        // Keep-alive connections: 5s timeout
        if (idleTime > this.keepAliveTimeout) {
          fdsToClose.push(fd);
        }
      } else {
        if (idleTime > 2000) {
          fdsToClose.push(fd);
        }
      }
      
      // Close big buffers to prevent attacks
      if (clientData.buffer.length > 1048576) { // 1MB
        console.log(`Closing fd=${fd} due to large buffer (${clientData.buffer.length} bytes)`);
        fdsToClose.push(fd);
      }
    }
    
    for (const fd of fdsToClose) {
      this._closeClient(fd);
    }
  }

  _closeClient(fd) {
    try {
      try {
        sockets.epoll_ctl(this.epollFd, sockets.EPOLL_CTL_DEL, fd, 0);
      } catch (e) {
        // Ignore if already closed
      }
      
      sockets.close(fd);
      
      this.clients.delete(fd);
      
    } catch (e) {
      // Ignore closing errors
    }
  }

  close() {
    this.running = false;
    
    for (const [fd] of this.clients) {
      this._closeClient(fd);
    }
    
    if (this.epollFd !== null) {
      sockets.close(this.epollFd);
      this.epollFd = null;
    }
    
    if (this.serverFd !== null) {
      sockets.close(this.serverFd);
      this.serverFd = null;
    }
    
    console.log('Server closed');
  }
}

function express() {
  return new Express();
}

export { express, Express, Router };
export default express;
