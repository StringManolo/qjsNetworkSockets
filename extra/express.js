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

    // Parse path and query string
    const urlParts = this.url.split('?');
    this.path = urlParts[0];

    if (urlParts[1]) {
      const queryPairs = urlParts[1].split('&');
      for (const pair of queryPairs) {
        const [key, value] = pair.split('=');
        this.query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    // Parse headers
    let i = 1;
    while (i < lines.length && lines[i] !== '') {
      const [key, ...valueParts] = lines[i].split(':');
      if (key) {
        this.headers[key.toLowerCase().trim()] = valueParts.join(':').trim();
      }
      i++;
    }

    // Body is after the empty line
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

    sockets.send(this.clientFd, response, 0);
    this.sent = true;
  }

  json(obj) {
    this.set('Content-Type', 'application/json; charset=utf-8');
    this.send(JSON.stringify(obj));
  }

  html(html) {
    this.set('Content-Type', 'text/html; charset=utf-8');
    this.send(html);
  }

  text(text) {
    this.set('Content-Type', 'text/plain; charset=utf-8');
    this.send(text);
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
    // Convert pattern with :params to regex
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

    // Find and execute route
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
  }

  listen(port, host = '0.0.0.0', callback) {
    this.serverFd = sockets.socket(sockets.AF_INET, sockets.SOCK_STREAM, 0);

    // Allow address reuse
    sockets.setsockopt(this.serverFd, sockets.SOL_SOCKET, sockets.SO_REUSEADDR, 1);

    sockets.bind(this.serverFd, host, port);
    sockets.listen(this.serverFd, 128);

    if (callback) callback();

    console.log(`Server listening on ${host}:${port}`);

    // Main event loop
    while (true) {
      try {
        const client = sockets.accept(this.serverFd);
        this._handleClient(client);
      } catch (e) {
        console.error('Error accepting client:', e);
      }
    }
  }

  _handleClient(clientInfo) {
    try {
      // Read request
      const data = sockets.recv(clientInfo.fd, 8192, 0);

      if (data.length === 0) {
        sockets.close(clientInfo.fd);
        return;
      }

      const req = new Request(data, clientInfo);
      const res = new Response(clientInfo.fd);

      // Process request synchronously
      try {
        this._handleRequest(req, res);
      } catch (err) {
        console.error('Error processing request:', err);
        if (!res.sent) {
          res.status(500).send('Internal Server Error');
        }
      }

      // Close connection immediately after sending
      sockets.close(clientInfo.fd);

    } catch (e) {
      console.error('Error handling client:', e);
      try {
        sockets.close(clientInfo.fd);
      } catch (e2) {}
    }
  }

  close() {
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
