import createServer from '../extra/tcp.js';

const server = createServer();

server.validMethods = [ // Everything else will be a 501 Not implemented by default
  "OPTIONS",
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "TRACE",
  "CONNECT",
  "PATCH",
  "QjS+SpEc1aL-Valid%Method" /* RFC allows this */
];


class HttpParseError extends Error {}
class HttpNotImplemented extends Error {}

const httpParser = {};
httpParser.getLines = rawRequest => {
  if (rawRequest.includes("\r\n")) {
    return rawRequest.split("\r\n");
  }
  throw new HttpParseError("missing CRLF");
}

httpParser.getMethod = method => {
  let isValidMethod = false;
  let isImplementedMethod = false;

  if (/^[!#$%&'*+\-.^_{}|~0-9a-zA-Z]+$/.test(method)) {
    isValidMethod = true;
  }

  if (!isValidMethod) {
    throw new HttpParseError(`method """${method}""" is not a valid "TOKEN" by RFC`); 
  }

  for (let j = 0; j < server.validMethods.length; ++j) {
    if (method === server.validMethods[j]) {
      isImplementedMethod = true;
    }
  }

  if (!isImplementedMethod) {
    throw new HttpNotImplemented(`method ${method} not implemented`);
  }
  return method;
}

httpParser.parseRawRequest = (rawRequest) => {
  const requestObject = {};
  requestObject.error = {};
  requestObject.hasError = false;
  requestObject.error.errorMsg = "unset"
  requestObject.error.httpCode = "unset"

  let requestLines;
  try {
    requestLines = httpParser.getLines(rawRequest);
  } catch (err) {
    if (err instanceof HttpParseError) {
      requestObject.hasError = true;
      requestObject.error.httpCode = 400
      requestObject.error.errorMsg = err.message;
      return requestObject;
    } else {
      requestObject.hasError = true;
      requestObject.error.httpCode = 400
      requestObject.error.errorMsg = "unknown";
      return requestObject;
    }
  }

  try {
    for (let i = 0; i < requestLines.length; ++i) {
      // First request line
      if (i === 0) {
        const requestLine = requestLines[0];
        if (requestLine.includes(" ")) {
          const components = requestLine.split(" ");
          if (components.length === 3) {
            requestObject.method = httpParser.getMethod(components[0]);
            requestObject.uri = components[1];
            requestObject.protocol = components[2]; 
          } else {
            throw new HttpParseError(`found ${components.length}, expected 3 for first line of the http request`);
          }
        } else {
          throw new HttpParseError(`first line of the http request missing components`);
        }
      } else if (i === 1) { // maybe join all headers? check rfc for headers priority

      }
    }
  } catch (err) {
    requestObject.hasError = true;
    if (err instanceof HttpParseError) {
      requestObject.error.httpCode = 400;
      requestObject.error.errorMsg = err.message;
    } else if (err instanceof HttpNotImplemented) { 
      requestObject.error.httpCode = 501;
      requestObject.error.errorMsg = err.message;
    } else {
      requestObject.error.httpCode = 400
      requestObject.error.errorMsg = "unknown";
      console.log("DEBUG: ", err + "");
    }
  }

  return requestObject;
}


server.onConnection = (conn) => {
  console.log(`New connection from ${conn.remoteAddr}:${conn.remotePort}`);
};

server.onData = (conn) => {
 // console.log('Raw data:', conn.buffer);
  let req = {};
  try {
    req = httpParser.parseRawRequest(conn.buffer);
  } catch (err) {
    console.log(`Code error: ${err}`);
    // TODO: Close gracefully, log.
  }

  
  console.log(JSON.stringify(req, null, 2));


  if (conn.buffer.includes('\r\n\r\n')) {
    const response = 
      'HTTP/1.1 200 OK\r\n' +
      'Content-Type: text/plain\r\n' +
      'Content-Length: 13\r\n' +
      'Connection: close\r\n' +
      '\r\n' +
      'Hello, World!';
    
    conn.write(response);
    conn.buffer = '';
    server.closeConnection(conn);
  }
};

server.onClose = (conn) => {
  console.log(`Connection closed: ${conn.fd}`);
};

server.onError = (err) => {
  console.error('Server error:', err);
};

server.listen(8080, '0.0.0.0');
