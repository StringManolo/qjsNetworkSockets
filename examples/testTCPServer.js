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

server.validProtocols = [
  "HTTP/1.0",
  "HTTP/1.1",
  "HTTP/2.0"
];

server.methodsWithBody = [
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "GET" // RFC 7231 allows "fat GET"
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

httpParser.getUri = uri => {
  let isValidUri = false;

  // RFC 3986: URI can contain unreserved, reserved, and percent-encoded characters
  if (/^[!#$%&'()*+,\-.\/:;=?@[\]_~0-9a-zA-Z]+$/.test(uri)) {
    isValidUri = true;
  }

  if (!isValidUri) {
    throw new HttpParseError(`uri """${uri}""" is not valid by RFC`);
  }

  return uri;
}

httpParser.getProtocol = protocol => {
  let isValidProtocol = false;
  let isImplementedProtocol = false;

  if (/^HTTP\/[0-9]\.[0-9]$/.test(protocol)) {
    isValidProtocol = true;
  }

  if (!isValidProtocol) {
    throw new HttpParseError(`protocol """${protocol}""" is not valid`);
  }

  for (let j = 0; j < server.validProtocols.length; ++j) {
    if (protocol === server.validProtocols[j]) {
      isImplementedProtocol = true;
    }
  }

  if (!isImplementedProtocol) {
    throw new HttpNotImplemented(`protocol ${protocol} not implemented`);
  }
  return protocol;
}

httpParser.getHeaders = requestLines => {
  const headers = {};
  let isValidHeader = false;

  for (let i = 1; i < requestLines.length; ++i) {
    const line = requestLines[i];
    
    // Empty line means end of headers
    if (line === "") {
      break;
    }

    isValidHeader = false;

    if (line.includes(":")) {
      const colonIndex = line.indexOf(":");
      const fieldName = line.substring(0, colonIndex);
      const fieldValue = line.substring(colonIndex + 1).trim();

      // RFC 7230: field-name = token
      if (/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/.test(fieldName)) {
        isValidHeader = true;
      }

      if (!isValidHeader) {
        throw new HttpParseError(`header field-name """${fieldName}""" is not a valid "TOKEN" by RFC`);
      }

      headers[fieldName] = fieldValue;
    } else {
      throw new HttpParseError(`header line """${line}""" missing colon separator`);
    }
  }

  return headers;
}

httpParser.getBody = (rawRequest, method, headers) => {
  let hasBodySupport = false;
  let hasBody = false;
  const bodyInfo = {};
  
  bodyInfo.raw = "";
  bodyInfo.contentLength = 0;
  bodyInfo.contentType = "unset";
  bodyInfo.contentEncoding = "unset";
  bodyInfo.transferEncoding = "unset";

  // Check if method supports body
  for (let j = 0; j < server.methodsWithBody.length; ++j) {
    if (method === server.methodsWithBody[j]) {
      hasBodySupport = true;
    }
  }

  if (!hasBodySupport) {
    return bodyInfo;
  }

  // Extract body-related headers
  if (headers["Content-Length"]) {
    bodyInfo.contentLength = parseInt(headers["Content-Length"], 10);
    if (isNaN(bodyInfo.contentLength) || bodyInfo.contentLength < 0) {
      throw new HttpParseError(`Content-Length """${headers["Content-Length"]}""" is not a valid number`);
    }
    hasBody = true;
  }

  if (headers["Transfer-Encoding"]) {
    bodyInfo.transferEncoding = headers["Transfer-Encoding"];
    hasBody = true;
  }

  if (headers["Content-Type"]) {
    bodyInfo.contentType = headers["Content-Type"];
  }

  if (headers["Content-Encoding"]) {
    bodyInfo.contentEncoding = headers["Content-Encoding"];
  }

  if (!hasBody) {
    return bodyInfo;
  }

  // Extract body from raw request
  const headerEndIndex = rawRequest.indexOf("\r\n\r\n");
  if (headerEndIndex === -1) {
    throw new HttpParseError("missing end of headers marker");
  }

  const bodyStart = headerEndIndex + 4; // Skip \r\n\r\n
  const rawBody = rawRequest.substring(bodyStart);

  // Handle Transfer-Encoding: chunked
  if (bodyInfo.transferEncoding.toLowerCase().includes("chunked")) {
    // TODO: Parse chunked encoding
    bodyInfo.raw = rawBody;
    return bodyInfo;
  }

  // Handle Content-Length
  if (bodyInfo.contentLength > 0) {
    if (rawBody.length < bodyInfo.contentLength) {
      throw new HttpParseError(`body incomplete: expected ${bodyInfo.contentLength} bytes, got ${rawBody.length}`);
    }
    bodyInfo.raw = rawBody.substring(0, bodyInfo.contentLength);
  } else {
    bodyInfo.raw = rawBody;
  }

  return bodyInfo;
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
    // Parse request line
    const requestLine = requestLines[0];
    if (requestLine.includes(" ")) {
      const components = requestLine.split(" ");
      if (components.length === 3) {
        requestObject.method = httpParser.getMethod(components[0]);
        requestObject.uri = httpParser.getUri(components[1]);
        requestObject.protocol = httpParser.getProtocol(components[2]);
      } else {
        throw new HttpParseError(`found ${components.length}, expected 3 for first line of the http request`);
      }
    } else {
      throw new HttpParseError(`first line of the http request missing components`);
    }

    // Parse headers
    requestObject.headers = httpParser.getHeaders(requestLines);

    // Parse body
    requestObject.body = httpParser.getBody(rawRequest, requestObject.method, requestObject.headers);
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
