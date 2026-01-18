import sockets from '../dist/network_sockets.so';

class Request {
  constructor(parsedRequest, clientInfo) {
    this.clientInfo = clientInfo;
    
    // El parsing ya está hecho en C - solo asignar propiedades
    this.method = parsedRequest.method || '';
    this.url = parsedRequest.url || '';
    this.path = parsedRequest.path || '';
    this.query = parsedRequest.query || {};
    this.headers = parsedRequest.headers || {};
    this.body = parsedRequest.body || '';
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
      'Connection': 'keep-alive', 
      'Keep-Alive': 'timeout=5, max=1000'
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

  send(body) {
    if (this.sent) return;

    let data = body;
    if (typeof body === 'object') {
      data = JSON.stringify(body);
      this.headers['Content-Type'] = 'application/json; charset=utf-8';
    } else {
      data = String(body);
    }

    this.headers['Content-Length'] = data.length;

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

    const statusText = statusMessages[this.statusCode] || 'Unknown';
    let response = `HTTP/1.1 ${this.statusCode} ${statusText}\r\n`;

    for (const [key, value] of Object.entries(this.headers)) {
      response += `${key}: ${value}\r\n`;
    }

    response += '\r\n' + data;

    this._buffer = response;
    this.sent = true;
    return response;
  }

  json(obj) {
    this.set('Content-Type', 'application/json; charset=utf-8');
    return this.send(JSON.stringify(obj));
  }

  html(html) {
    this.set('Content-Type', 'text/html; charset=utf-8');
    return this.send(html);
  }

  text(text) {
    this.set('Content-Type', 'text/plain; charset=utf-8');
    return this.send(text);
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
    for (const mw of this.middlewares) {
      if (mw.path === null || req.path.startsWith(mw.path)) {
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        mw.handler(req, res, next);

        if (!nextCalled || res.sent) return;
      }
    }

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
  }

  listen(port, host = '0.0.0.0', callback) {
    this.serverFd = sockets.socket(sockets.AF_INET, sockets.SOCK_STREAM, 0);

    // Configurar servidor para máximo rendimiento
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEPORT, 1);  // ← ¡NUEVO!

    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_RCVBUF, 262144); // 256KB
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_SNDBUF, 262144); // 256KB
    
    sockets.bind(this.serverFd, host, port);
    sockets.listen(this.serverFd, 2048); // Backlog más grande
    sockets.setnonblocking(this.serverFd);

    // Crear epoll
    this.epollFd = sockets.epoll_create1(0);
    
    // Agregar servidor al epoll
    sockets.epoll_ctl(
      this.epollFd,
      sockets.EPOLL_CTL_ADD,
      this.serverFd,
      sockets.EPOLLIN | sockets.EPOLLET
    );

    if (typeof callback === 'function') {
      callback();
    }

    // Event loop con epoll - timeout muy bajo
    while (true) {
      try {
        const events = sockets.epoll_wait(this.epollFd, 512, 1); // 1ms timeout
        
        for (const event of events) {
          if (event.fd === this.serverFd) {
            this._acceptConnections();
          } else {
            this._handleClientEvent(event);
          }
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  _acceptConnections() {
    // Aceptar todas las conexiones pendientes (edge-triggered)
    while (true) {
      try {
        const client = sockets.accept(this.serverFd);
        if (!client) break;

        // Configurar socket del cliente para máximo rendimiento
        sockets.setnonblocking(client.fd);
        sockets.setsockopt(client.fd, sockets.IPPROTO_TCP, sockets.TCP_NODELAY, 1);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_KEEPALIVE, 1);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_RCVBUF, 65536);
        sockets.setsockopt(client.fd, sockets.SOL_SOCKET, sockets.SO_SNDBUF, 65536);

        // Agregar cliente al epoll
        sockets.epoll_ctl(
          this.epollFd,
          sockets.EPOLL_CTL_ADD,
          client.fd,
          sockets.EPOLLIN | sockets.EPOLLET
        );

        // Guardar info del cliente
        this.clients.set(client.fd, {
          info: client,
          buffer: '',
          requestCount: 0,
          lastActivity: Date.now()
        });
      } catch (e) {
        break;
      }
    }
  }

  _handleClientEvent(event) {
    const clientData = this.clients.get(event.fd);
    if (!clientData) return;

    // Cerrar si hay error
    if (event.events & (sockets.EPOLLERR | sockets.EPOLLHUP)) {
      this._closeClient(event.fd);
      return;
    }

    try {
      // Leer TODOS los datos disponibles (edge-triggered)
      while (true) {
        const chunk = sockets.recv(event.fd, 16384, 0); // Buffer más grande
        if (!chunk || chunk.length === 0) break;
        
        clientData.buffer += chunk;
      }

      // Procesar múltiples requests en el buffer (pipelining)
      this._processBuffer(event.fd, clientData);

    } catch (e) {
      this._closeClient(event.fd);
    }
  }

  _processBuffer(fd, clientData) {
    // Procesar todas las requests completas en el buffer
    while (clientData.buffer.length > 0) {
      // Buscar el final de los headers
      const headerEnd = clientData.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return; // Headers incompletos, esperar más datos

      // Parsear headers para obtener Content-Length
      const headersPart = clientData.buffer.substring(0, headerEnd);
      const contentLengthMatch = headersPart.match(/Content-Length:\s*(\d+)/i);
      const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;

      // Verificar si tenemos el body completo
      const totalLength = headerEnd + 4 + contentLength;
      if (clientData.buffer.length < totalLength) return; // Body incompleto, esperar más datos

      // Extraer la request completa
      const requestData = clientData.buffer.substring(0, totalLength);
      clientData.buffer = clientData.buffer.substring(totalLength);

      // Procesar la request usando el parser nativo de C
      try {
        // Parser nativo hace TODO el trabajo pesado en C
        const parsedRequest = sockets.parse_http_request(requestData);
        const req = new Request(parsedRequest, clientData.info);
        const res = new Response(fd);

        this._handleRequest(req, res);

        if (res.sent && res._buffer) {
          // Enviar respuesta
          this._sendResponse(fd, res._buffer);

          clientData.requestCount++;
          clientData.lastActivity = Date.now();

          // Cerrar si el cliente pidió Connection: close
          if (req.headers['connection'] === 'close' || clientData.requestCount >= 1000) {
            this._closeClient(fd);
            return;
          }
        }
      } catch (e) {
        // Error procesando, cerrar conexión
        this._closeClient(fd);
        return;
      }
    }
  }

  _sendResponse(fd, data) {
    let sent = 0;
    while (sent < data.length) {
      try {
        const n = sockets.send(fd, data.slice(sent), 0);
        if (n <= 0) break;
        sent += n;
      } catch (e) {
        break;
      }
    }
  }

  _closeClient(fd) {
    try {
      sockets.epoll_ctl(this.epollFd, sockets.EPOLL_CTL_DEL, fd, 0);
      sockets.close(fd);
      this.clients.delete(fd);
    } catch (e) {
      // Ignore
    }
  }

  close() {
    if (this.epollFd !== null) {
      sockets.close(this.epollFd);
      this.epollFd = null;
    }
    if (this.serverFd !== null) {
      sockets.close(this.serverFd);
      this.serverFd = null;
    }
  }
}

function express() {
  return new Express();
}

export { express, Express, Router };
export default express;
