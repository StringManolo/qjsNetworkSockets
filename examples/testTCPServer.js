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

const httpResponse = {};

const getByteLength = (str) => {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7F) {
      len += 1;
    } else if (code <= 0x7FF) {
      len += 2;
    } else if (code <= 0xFFFF) {
      len += 3;
    } else {
      len += 4;
    }
  }
  return len;
};

httpResponse.htmlTemplate = (title, mainContent) => {
  const header = `
    <h1>qjsNetworkSockets HTTP Server</h1>
    <nav>
      <a href="/">Home</a> |
      <a href="/about">About</a> |
      <a href="/status">Status</a>
    </nav>
  `;

  const footer = `
    <hr>
    <p>Powered by qjsNetworkSockets | QuickJS HTTP/1.1 Server</p>
    <p><small>RFC 7230-7235 Compliant</small></p>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head prefix="og:http://ogp.me/ns#">
  <meta charset="utf-8">
  <link rel="icon" href="data:;base64,iVBORw0KGgo=">
  <title>${title}</title>
  <style>
    body { font-family: monospace; max-width: 800px; margin: 50px auto; padding: 20px; }
    header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    footer { border-top: 2px solid #333; padding-top: 10px; margin-top: 20px; text-align: center; }
    .error-code { font-size: 72px; font-weight: bold; color: #d32f2f; }
    .error-message { font-size: 24px; color: #666; }
    .error-details { background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #d32f2f; }
    .success { color: #2e7d32; }
  </style>
</head>
<body>
  <header>${header}</header>
  <main>${mainContent}</main>
  <footer>${footer}</footer>
</body>
</html>`;
};

httpResponse.generate200 = () => {
  const mainContent = `
    <div class="success">
      <h2>✓ 200 OK</h2>
      <p>Your request was processed successfully.</p>
      <p>Welcome to qjsNetworkSockets HTTP Server - A lightweight, RFC-compliant HTTP/1.1 server implementation.</p>
    </div>
  `;

  const body = httpResponse.htmlTemplate('200 OK', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generate400 = (errorMsg) => {
  const mainContent = `
    <div class="error-code">400</div>
    <div class="error-message">Bad Request</div>
    <div class="error-details">
      <h3>Error Details:</h3>
      <p><strong>Message:</strong> ${errorMsg}</p>
      <p><strong>Cause:</strong> The server cannot process the request due to malformed syntax or invalid request message framing.</p>
      <h4>Common Issues:</h4>
      <ul>
        <li>Invalid HTTP method token (e.g., contains spaces or invalid characters)</li>
        <li>Malformed URI (e.g., contains disallowed characters)</li>
        <li>Invalid protocol format (e.g., not HTTP/X.Y)</li>
        <li>Malformed headers (e.g., missing colon separator)</li>
        <li>Invalid Content-Length header</li>
        <li>Incomplete request body</li>
        <li>Missing required headers (e.g., Host in HTTP/1.1)</li>
        <li>Invalid chunked encoding (e.g., malformed chunk size, missing CRLF)</li>
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('400 Bad Request', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 400 Bad Request\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generate501 = (errorMsg) => {
  const mainContent = `
    <div class="error-code">501</div>
    <div class="error-message">Not Implemented</div>
    <div class="error-details">
      <h3>Error Details:</h3>
      <p><strong>Message:</strong> ${errorMsg}</p>
      <p><strong>Cause:</strong> The server does not support the functionality required to fulfill the request.</p>
      <h4>Supported Methods:</h4>
      <ul>
        ${server.validMethods.map(m => `<li>${m}</li>`).join('\n        ')}
      </ul>
      <h4>Supported Protocols:</h4>
      <ul>
        ${server.validProtocols.map(p => `<li>${p}</li>`).join('\n        ')}
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('501 Not Implemented', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 501 Not Implemented\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generate404 = (uri) => {
  const mainContent = `
    <div class="error-code">404</div>
    <div class="error-message">Not Found</div>
    <div class="error-details">
      <h3>Error Details:</h3>
      <p><strong>Requested URI:</strong> ${uri}</p>
      <p><strong>Cause:</strong> The requested resource could not be found on this server.</p>
      <h4>Available Routes:</h4>
      <ul>
        <li><a href="/">/ - Home</a></li>
        <li><a href="/about">/about - About</a></li>
        <li><a href="/status">/status - Server Status</a></li>
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('404 Not Found', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 404 Not Found\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generateRouteHome = () => {
  const mainContent = `
    <div class="success">
      <h2>🏠 Home</h2>
      <p>Welcome to qjsNetworkSockets HTTP Server!</p>
      <h3>About This Server:</h3>
      <p>This is a lightweight, RFC-compliant HTTP/1.1 server implementation built with QuickJS.</p>
      <h3>Features:</h3>
      <ul>
        <li>RFC 7230-7235 compliant HTTP/1.1 parsing</li>
        <li>Support for multiple HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)</li>
        <li>Proper error handling with meaningful error pages</li>
        <li>Header validation and body parsing</li>
        <li>Transfer-Encoding: chunked support</li>
        <li>Fat GET support (RFC 7231)</li>
        <li>Required header validation (Host for HTTP/1.1)</li>
      </ul>
      <h3>Quick Links:</h3>
      <ul>
        <li><a href="/about">About</a> - Learn more about this server</li>
        <li><a href="/status">Status</a> - Check server status</li>
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('Home - qjsNetworkSockets', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generateRouteAbout = () => {
  const mainContent = `
    <div class="success">
      <h2>ℹ️ About</h2>
      <h3>qjsNetworkSockets HTTP Server</h3>
      <p>A minimal HTTP/1.1 server implementation using QuickJS runtime.</p>
      
      <h3>Technical Details:</h3>
      <ul>
        <li><strong>Runtime:</strong> QuickJS</li>
        <li><strong>Protocol:</strong> HTTP/1.1 (RFC 7230-7235)</li>
        <li><strong>Language:</strong> JavaScript (ES6+)</li>
        <li><strong>Transport:</strong> TCP Sockets</li>
      </ul>

      <h3>Supported HTTP Methods:</h3>
      <ul>
        ${server.validMethods.map(m => `<li>${m}</li>`).join('\n        ')}
      </ul>

      <h3>Supported HTTP Protocols:</h3>
      <ul>
        ${server.validProtocols.map(p => `<li>${p}</li>`).join('\n        ')}
      </ul>

      <h3>RFC Compliance:</h3>
      <ul>
        <li>RFC 7230 - Message Syntax and Routing</li>
        <li>RFC 7231 - Semantics and Content</li>
        <li>RFC 3986 - URI Generic Syntax</li>
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('About - qjsNetworkSockets', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.generateRouteStatus = () => {
  const mainContent = `
    <div class="success">
      <h2>📊 Server Status</h2>
      <h3>Current Status: <span style="color: #2e7d32;">✓ Online</span></h3>
      
      <h3>Server Information:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Server Software:</strong></td>
          <td style="padding: 8px;">qjsNetworkSockets/1.0</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Runtime:</strong></td>
          <td style="padding: 8px;">QuickJS</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Protocol:</strong></td>
          <td style="padding: 8px;">HTTP/1.1</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Port:</strong></td>
          <td style="padding: 8px;">8080</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Timestamp:</strong></td>
          <td style="padding: 8px;">${new Date().toISOString()}</td>
        </tr>
      </table>

      <h3>Capabilities:</h3>
      <ul>
        <li>✓ HTTP Method Validation</li>
        <li>✓ URI Parsing</li>
        <li>✓ Protocol Validation</li>
        <li>✓ Header Parsing</li>
        <li>✓ Body Parsing (Content-Length)</li>
        <li>✓ Body Parsing (Transfer-Encoding: chunked)</li>
        <li>✓ Required Header Validation (Host for HTTP/1.1)</li>
        <li>✓ Error Handling (400, 404, 501)</li>
        <li>✓ Basic Routing</li>
      </ul>
    </div>
  `;

  const body = httpResponse.htmlTemplate('Status - qjsNetworkSockets', mainContent);
  const contentLength = getByteLength(body);

  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${contentLength}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
};

httpResponse.routeRequest = (uri) => {
  if (uri === "/" || uri === "") {
    return httpResponse.generateRouteHome();
  } else if (uri === "/about") {
    return httpResponse.generateRouteAbout();
  } else if (uri === "/status") {
    return httpResponse.generateRouteStatus();
  } else {
    return httpResponse.generate404(uri);
  }
};

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

httpParser.validateRequiredHeaders = (protocol, headers) => {
  let hasRequiredHeaders = true;

  // RFC 7230: HTTP/1.1 requires Host header
  if (protocol === "HTTP/1.1") {
    if (!headers["Host"]) {
      hasRequiredHeaders = false;
      throw new HttpParseError(`HTTP/1.1 requires "Host" header`);
    }

    // Host header must not be empty
    if (headers["Host"].trim() === "") {
      hasRequiredHeaders = false;
      throw new HttpParseError(`"Host" header must not be empty`);
    }
  }

  return hasRequiredHeaders;
}

httpParser.parseChunkedBody = (rawBody) => {
  let completeBody = "";
  let currentIndex = 0;
  let isValidChunk = false;
  let hasMoreChunks = true;

  while (hasMoreChunks) {
    isValidChunk = false;

    // Find the end of the chunk size line
    const chunkSizeEndIndex = rawBody.indexOf("\r\n", currentIndex);
    if (chunkSizeEndIndex === -1) {
      throw new HttpParseError("chunked encoding: missing CRLF after chunk size");
    }

    // Extract chunk size (in hexadecimal)
    const chunkSizeLine = rawBody.substring(currentIndex, chunkSizeEndIndex);
    
    // Validate chunk size is valid hex
    if (/^[0-9a-fA-F]+$/.test(chunkSizeLine)) {
      isValidChunk = true;
    }

    if (!isValidChunk) {
      throw new HttpParseError(`chunked encoding: chunk size """${chunkSizeLine}""" is not valid hexadecimal`);
    }

    const chunkSize = parseInt(chunkSizeLine, 16);
    
    if (isNaN(chunkSize) || chunkSize < 0) {
      throw new HttpParseError(`chunked encoding: chunk size """${chunkSizeLine}""" is not a valid number`);
    }

    // Chunk size 0 means end of chunks
    if (chunkSize === 0) {
      hasMoreChunks = false;
      break;
    }

    // Move index to start of chunk data (skip size line + CRLF)
    currentIndex = chunkSizeEndIndex + 2;

    // Extract chunk data
    const chunkData = rawBody.substring(currentIndex, currentIndex + chunkSize);
    
    if (chunkData.length < chunkSize) {
      throw new HttpParseError(`chunked encoding: incomplete chunk data, expected ${chunkSize} bytes, got ${chunkData.length}`);
    }

    completeBody += chunkData;

    // Move index past chunk data
    currentIndex += chunkSize;

    // Verify CRLF after chunk data
    const chunkEndCRLF = rawBody.substring(currentIndex, currentIndex + 2);
    if (chunkEndCRLF !== "\r\n") {
      throw new HttpParseError("chunked encoding: missing CRLF after chunk data");
    }

    // Move index past the CRLF
    currentIndex += 2;
  }

  return completeBody;
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
    bodyInfo.raw = httpParser.parseChunkedBody(rawBody);
    bodyInfo.contentLength = bodyInfo.raw.length;
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

    // Validate required headers
    httpParser.validateRequiredHeaders(requestObject.protocol, requestObject.headers);

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

 // console.log(JSON.stringify(req, null, 2));
try {

  if (conn.buffer.includes('\r\n\r\n')) {
    let response = '';

    if (req.hasError) {
      if (req.error.httpCode === 400) {
        response = httpResponse.generate400(req.error.errorMsg);
      } else if (req.error.httpCode === 501) {
        response = httpResponse.generate501(req.error.errorMsg);
      } else {
        // Fallback to 400 for unknown errors
        response = httpResponse.generate400(req.error.errorMsg);
      }
    } else {
      // Route the request based on URI
      response = httpResponse.routeRequest(req.uri);
    }

    console.log("Sending response...");
    conn.write(response);
    conn.buffer = '';
    server.closeConnection(conn);
  }
} catch(err) {
  console.log("wtf:" + err);
}
};

server.onClose = (conn) => {
  console.log(`Connection closed: ${conn.fd}`);
};

server.onError = (err) => {
  console.log('Server error:' + err);
};

server.listen(8080, '0.0.0.0');
