import sockets from '../dist/network_sockets.so';

class Request {
  constructor(rawRequest, clientInfo) {
    this.raw = rawRequest;
    this.clientInfo = clientInfo;
    this.method = '';
    this.url = '';
    this.path = '';
    this.query = {};
    this.headers = {};
    this.body = '';
    this.params = {};

    this._parse(rawRequest);
  }

  _parse(raw) {
    const lines = raw.split('\r\n');
    const requestLine = lines[0].split(' ');

    this.method = requestLine[0];
    this.url = requestLine[1];

    const urlParts = this.url.split('?');
    this.path = urlParts[0];

    if (urlParts[1]) {
      const queryPairs = urlParts[1].split('&');
      for (const pair of queryPairs) {
        const [key, value] = pair.split('=');
        this.query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    let i = 1;
    while (i < lines.length && lines[i] !== '') {
      const [key, ...valueParts] = lines[i].split(':');
      if (key) {
        this.headers[key.toLowerCase().trim()] = valueParts.join(':').trim();
      }
      i++;
    }

    if (i < lines.length - 1) {
      this.body = lines.slice(i + 1).join('\r\n');
    }
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
      'Connection': 'close'
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

    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);
    sockets.bind(this.serverFd, host, port);
    sockets.listen(this.serverFd, 1024);
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

    // Event loop con epoll
    while (true) {
      try {
        const events = sockets.epoll_wait(this.epollFd, 256, 1000);
        
        for (const event of events) {
          if (event.fd === this.serverFd) {
            // Nueva conexión
            this._acceptConnections();
          } else {
            // Datos de cliente
            this._handleClientEvent(event);
          }
        }
      } catch (e) {
        // console.log('Event loop error:', e);
      }
    }
  }

  _acceptConnections() {
    // Aceptar todas las conexiones pendientes
    while (true) {
      try {
        const client = sockets.accept(this.serverFd);
        if (!client) break; // No hay más conexiones

        // Configurar socket del cliente
        sockets.setnonblocking(client.fd);
        sockets.setsockopt(client.fd, sockets.IPPROTO_TCP, sockets.TCP_NODELAY, 1);

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
          responseBuffer: ''
        });
      } catch (e) {
        break;
      }
    }
  }

  _handleClientEvent(event) {
    const clientData = this.clients.get(event.fd);
    if (!clientData) return;

    try {
      // Leer todos los datos disponibles
      while (true) {
        const chunk = sockets.recv(event.fd, 8192, 0);
        if (!chunk || chunk.length === 0) break;
        
        clientData.buffer += chunk;
        
        // Si ya tenemos una petición HTTP completa
        if (clientData.buffer.includes('\r\n\r\n')) {
          this._processRequest(event.fd, clientData);
          break;
        }
      }

      // Si hay error o cierre
      if (event.events & (sockets.EPOLLERR | sockets.EPOLLHUP)) {
        this._closeClient(event.fd);
      }
    } catch (e) {
      this._closeClient(event.fd);
    }
  }

  _processRequest(fd, clientData) {
    try {
      const req = new Request(clientData.buffer, clientData.info);
      const res = new Response(fd);

      this._handleRequest(req, res);

      if (res.sent && res._buffer) {
        // Enviar respuesta
        const data = res._buffer;
        let sent = 0;
        
        while (sent < data.length) {
          const n = sockets.send(fd, data.slice(sent), 0);
          if (n <= 0) break;
          sent += n;
        }
      }
    } catch (e) {
      // console.log('Error processing:', e);
    } finally {
      this._closeClient(fd);
    }
  }

  _closeClient(fd) {
    try {
      sockets.epoll_ctl(this.epollFd, sockets.EPOLL_CTL_DEL, fd, 0);
      sockets.close(fd);
      this.clients.delete(fd);
    } catch (e) {
      // Ignore errors
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
