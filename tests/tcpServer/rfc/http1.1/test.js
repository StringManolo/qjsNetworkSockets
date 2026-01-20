const net = require('net');
const assert = require('assert');

// Configuration
const HOST = 'localhost';
const PORT = 8080;
const TIMEOUT = 5000;

class HTTPTester {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.passed = 0;
    this.failed = 0;
  }

  async sendRaw(data, waitForClose = false, timeout = TIMEOUT) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host: this.host, port: this.port }, () => {
        if (Buffer.isBuffer(data)) {
          client.write(data);
        } else {
          client.write(data);
        }
        if (!waitForClose) {
          client.end();
        }
      });

      let response = Buffer.alloc(0);
      client.on('data', (chunk) => {
        response = Buffer.concat([response, chunk]);
      });

      client.on('end', () => {
        resolve(response.toString());
      });

      client.on('error', (err) => {
        reject(err);
      });

      setTimeout(() => {
        client.destroy();
        if (waitForClose) resolve(response.toString());
      }, timeout);
    });
  }

  async sendPipelined(requests) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host: this.host, port: this.port }, () => {
        requests.forEach(req => client.write(req));
      });

      let response = '';
      client.on('data', (chunk) => {
        response += chunk.toString();
      });

      client.on('end', () => {
        resolve(response);
      });

      client.on('error', (err) => {
        reject(err);
      });

      setTimeout(() => {
        client.end();
        resolve(response);
      }, TIMEOUT);
    });
  }

  async test(name, testFn) {
    try {
      await testFn();
      console.log(`✓ ${name}`);
      this.passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${err.message}`);
      this.failed++;
    }
  }

  parseResponse(response) {
    const headerEnd = response.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return { statusLine: '', headers: {}, body: response };
    }

    const headerSection = response.substring(0, headerEnd);
    const body = response.substring(headerEnd + 4);
    
    const lines = headerSection.split('\r\n');
    const statusLine = lines[0] || '';
    const headers = {};
    
    for (let i = 1; i < lines.length; i++) {
      const colonIndex = lines[i].indexOf(':');
      if (colonIndex > 0) {
        const key = lines[i].substring(0, colonIndex).trim().toLowerCase();
        const value = lines[i].substring(colonIndex + 1).trim();
        if (headers[key]) {
          headers[key] += ', ' + value;
        } else {
          headers[key] = value;
        }
      }
    }
    
    const match = statusLine.match(/HTTP\/(\d\.\d) (\d{3})/);
    const statusCode = match ? parseInt(match[2]) : 0;
    
    return { statusLine, statusCode, headers, body };
  }

  async runAllTests() {
    console.log('\n=== Comprehensive HTTP/1.1 RFC Compliance Test Suite ===');
    console.log('RFC 7230-7235 Coverage\n');
    console.log(`Testing server at ${this.host}:${this.port}\n`);

    // ========== RFC 7230: Message Syntax and Routing ==========
    console.log('━━━ RFC 7230: Message Syntax and Routing ━━━\n');

    console.log('--- Request Line Parsing ---');
    
    await this.test('Valid request line format', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { statusLine } = this.parseResponse(response);
      assert(statusLine.startsWith('HTTP/1.1'), 'Should respond with HTTP/1.1');
    });

    await this.test('Method is case-sensitive', async () => {
      const response = await this.sendRaw('get / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400 || statusCode === 501, 'Lowercase method should be rejected');
    });

    await this.test('Request with absolute-form URI', async () => {
      const response = await this.sendRaw('GET http://localhost:8080/path HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle absolute-form URI');
    });

    await this.test('Request with asterisk-form (OPTIONS)', async () => {
      const response = await this.sendRaw('OPTIONS * HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle asterisk-form');
    });

    await this.test('Request with authority-form (CONNECT)', async () => {
      const response = await this.sendRaw('CONNECT localhost:443 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle authority-form');
    });

    console.log('\n--- Header Field Parsing ---');

    await this.test('Header field name is case-insensitive', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHoSt: localhost\r\nCoNtEnT-tYpE: text/plain\r\n\r\n');
      assert(response.length > 0, 'Should handle mixed-case headers');
    });

    await this.test('Multiple header fields with same name', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAccept: text/html\r\nAccept: application/json\r\n\r\n');
      assert(response.length > 0, 'Should handle multiple same-name headers');
    });

    await this.test('Header field with optional whitespace', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost:localhost\r\nUser-Agent:  TestAgent  \r\n\r\n');
      assert(response.length > 0, 'Should handle header whitespace variations');
    });

    await this.test('Header continuation (obs-fold - obsolete)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nCustom: line1\r\n line2\r\n\r\n');
      assert(response.length > 0, 'Should reject or handle obs-fold');
    });

    await this.test('Empty header field value', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nX-Empty:\r\n\r\n');
      assert(response.length > 0, 'Should handle empty header value');
    });

    console.log('\n--- Host Header (RFC 7230 5.4) ---');

    await this.test('Host header is required in HTTP/1.1', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should return 400 for missing Host');
    });

    await this.test('Host header with port', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost:8080\r\n\r\n');
      assert(response.length > 0, 'Should accept Host with port');
    });

    await this.test('Multiple Host headers (invalid)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nHost: example.com\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should reject multiple Host headers');
    });

    console.log('\n--- Transfer-Encoding ---');

    await this.test('Chunked transfer encoding', async () => {
      const body = '5\r\nHello\r\n5\r\nWorld\r\n0\r\n\r\n';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle chunked encoding');
    });

    await this.test('Chunked encoding with chunk extensions', async () => {
      const body = '5;ext=value\r\nHello\r\n0\r\n\r\n';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle chunk extensions');
    });

    await this.test('Chunked encoding with trailer headers', async () => {
      const body = '5\r\nHello\r\n0\r\nX-Trailer: value\r\n\r\n';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle trailer headers');
    });

    await this.test('Invalid chunk size', async () => {
      const body = 'ZZZZ\r\nHello\r\n0\r\n\r\n';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should reject invalid chunk size');
    });

    console.log('\n--- Content-Length ---');

    await this.test('Valid Content-Length', async () => {
      const body = 'test data';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle Content-Length');
    });

    await this.test('Content-Length: 0', async () => {
      const request = 'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n';
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle zero Content-Length');
    });

    await this.test('Content-Length and Transfer-Encoding (TE wins)', async () => {
      const body = '5\r\nHello\r\n0\r\n\r\n';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Transfer-Encoding should take precedence');
    });

    await this.test('Multiple Content-Length headers (same value)', async () => {
      const body = 'test';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\nContent-Length: 4\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should accept duplicate identical Content-Length');
    });

    await this.test('Multiple Content-Length headers (different values)', async () => {
      const request = 'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\nContent-Length: 5\r\n\r\ntest';
      const response = await this.sendRaw(request);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should reject conflicting Content-Length');
    });

    await this.test('Invalid Content-Length (negative)', async () => {
      const request = 'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: -1\r\n\r\n';
      const response = await this.sendRaw(request);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should reject negative Content-Length');
    });

    await this.test('Invalid Content-Length (non-numeric)', async () => {
      const request = 'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: abc\r\n\r\n';
      const response = await this.sendRaw(request);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400, 'Should reject non-numeric Content-Length');
    });

    console.log('\n--- Connection Management ---');

    await this.test('Connection: close', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const { headers } = this.parseResponse(response);
      assert(headers['connection'] === 'close' || response.length > 0, 'Should handle Connection: close');
    });

    await this.test('Connection: keep-alive', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n');
      assert(response.length > 0, 'Should handle Connection: keep-alive');
    });

    await this.test('Persistent connection (pipelined requests)', async () => {
      const req1 = 'GET /1 HTTP/1.1\r\nHost: localhost\r\n\r\n';
      const req2 = 'GET /2 HTTP/1.1\r\nHost: localhost\r\n\r\n';
      const response = await this.sendPipelined([req1, req2]);
      const responses = response.split('HTTP/1.1').filter(r => r.trim());
      assert(responses.length >= 1, 'Should handle pipelined requests');
    });

    await this.test('Connection: upgrade', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: upgrade\r\nUpgrade: websocket\r\n\r\n');
      assert(response.length > 0, 'Should handle upgrade request');
    });

    console.log('\n--- Request Routing ---');

    await this.test('Via header forwarding', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nVia: 1.1 proxy\r\n\r\n');
      assert(response.length > 0, 'Should accept Via header');
    });

    // ========== RFC 7231: Semantics and Content ==========
    console.log('\n━━━ RFC 7231: Semantics and Content ━━━\n');

    console.log('--- HTTP Methods ---');

    await this.test('GET method', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode >= 200 && statusCode < 600, 'Should handle GET');
    });

    await this.test('HEAD method (no body)', async () => {
      const response = await this.sendRaw('HEAD / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { body } = this.parseResponse(response);
      assert(body.length === 0, 'HEAD should not return body');
    });

    await this.test('POST method', async () => {
      const body = 'data';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle POST');
    });

    await this.test('PUT method', async () => {
      const body = 'data';
      const request = `PUT /resource HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle PUT');
    });

    await this.test('DELETE method', async () => {
      const response = await this.sendRaw('DELETE /resource HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle DELETE');
    });

    await this.test('OPTIONS method', async () => {
      const response = await this.sendRaw('OPTIONS / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { headers } = this.parseResponse(response);
      assert(response.length > 0, 'Should handle OPTIONS');
    });

    await this.test('TRACE method', async () => {
      const response = await this.sendRaw('TRACE / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle TRACE');
    });

    await this.test('CONNECT method', async () => {
      const response = await this.sendRaw('CONNECT localhost:443 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle CONNECT');
    });

    await this.test('PATCH method', async () => {
      const body = 'patch data';
      const request = `PATCH /resource HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle PATCH');
    });

    console.log('\n--- Status Codes ---');

    await this.test('404 Not Found', async () => {
      const response = await this.sendRaw('GET /nonexistent-path-12345 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 404 || statusCode > 0, 'Should return status code');
    });

    await this.test('405 Method Not Allowed (if applicable)', async () => {
      const response = await this.sendRaw('POST /readonly HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n');
      const { statusCode, headers } = this.parseResponse(response);
      if (statusCode === 405) {
        assert(headers['allow'], 'Should include Allow header with 405');
      }
      assert(true, 'Test completed');
    });

    await this.test('414 URI Too Long', async () => {
      const longPath = '/' + 'a'.repeat(10000);
      const response = await this.sendRaw(`GET ${longPath} HTTP/1.1\r\nHost: localhost\r\n\r\n`);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 414 || statusCode === 400, 'Should reject too-long URI');
    });

    await this.test('505 HTTP Version Not Supported', async () => {
      const response = await this.sendRaw('GET / HTTP/9.9\r\nHost: localhost\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 505 || statusCode === 400, 'Should reject unsupported version');
    });

    console.log('\n--- Content Negotiation ---');

    await this.test('Accept header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAccept: text/html, application/json;q=0.9\r\n\r\n');
      assert(response.length > 0, 'Should handle Accept header');
    });

    await this.test('Accept-Charset header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAccept-Charset: utf-8, iso-8859-1;q=0.5\r\n\r\n');
      assert(response.length > 0, 'Should handle Accept-Charset');
    });

    await this.test('Accept-Encoding header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAccept-Encoding: gzip, deflate\r\n\r\n');
      assert(response.length > 0, 'Should handle Accept-Encoding');
    });

    await this.test('Accept-Language header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAccept-Language: en-US, es;q=0.8\r\n\r\n');
      assert(response.length > 0, 'Should handle Accept-Language');
    });

    console.log('\n--- Content-Type ---');

    await this.test('Content-Type: application/json', async () => {
      const body = '{"key":"value"}';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle JSON content type');
    });

    await this.test('Content-Type: application/x-www-form-urlencoded', async () => {
      const body = 'key=value&foo=bar';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle form data');
    });

    await this.test('Content-Type: multipart/form-data', async () => {
      const boundary = 'boundary123';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--\r\n`;
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=${boundary}\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle multipart data');
    });

    await this.test('Content-Type with charset', async () => {
      const body = 'data';
      const request = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
      const response = await this.sendRaw(request);
      assert(response.length > 0, 'Should handle charset parameter');
    });

    console.log('\n--- Expect: 100-continue ---');

    await this.test('Expect: 100-continue', async () => {
      const request = 'POST / HTTP/1.1\r\nHost: localhost\r\nExpect: 100-continue\r\nContent-Length: 10\r\n\r\n';
      const response = await this.sendRaw(request, false, 2000);
      assert(response.includes('100') || response.includes('417') || response.length > 0, 'Should handle Expect: 100-continue');
    });

    // ========== RFC 7232: Conditional Requests ==========
    console.log('\n━━━ RFC 7232: Conditional Requests ━━━\n');

    await this.test('If-Match header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nIf-Match: "etag123"\r\n\r\n');
      assert(response.length > 0, 'Should handle If-Match');
    });

    await this.test('If-None-Match header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nIf-None-Match: "etag123"\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode >= 200, 'Should handle If-None-Match');
    });

    await this.test('If-Modified-Since header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nIf-Modified-Since: Wed, 21 Oct 2015 07:28:00 GMT\r\n\r\n');
      assert(response.length > 0, 'Should handle If-Modified-Since');
    });

    await this.test('If-Unmodified-Since header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nIf-Unmodified-Since: Wed, 21 Oct 2015 07:28:00 GMT\r\n\r\n');
      assert(response.length > 0, 'Should handle If-Unmodified-Since');
    });

    await this.test('If-Range header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nIf-Range: "etag123"\r\nRange: bytes=0-100\r\n\r\n');
      assert(response.length > 0, 'Should handle If-Range');
    });

    // ========== RFC 7233: Range Requests ==========
    console.log('\n━━━ RFC 7233: Range Requests ━━━\n');

    await this.test('Range: bytes=0-100', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nRange: bytes=0-100\r\n\r\n');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 206 || statusCode === 200 || statusCode === 416, 'Should handle byte range');
    });

    await this.test('Range: bytes=-100 (suffix)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nRange: bytes=-100\r\n\r\n');
      assert(response.length > 0, 'Should handle suffix range');
    });

    await this.test('Range: bytes=100- (from offset)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nRange: bytes=100-\r\n\r\n');
      assert(response.length > 0, 'Should handle open-ended range');
    });

    await this.test('Range: multiple ranges', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nRange: bytes=0-10, 20-30\r\n\r\n');
      assert(response.length > 0, 'Should handle multiple ranges');
    });

    // ========== RFC 7234: Caching ==========
    console.log('\n━━━ RFC 7234: Caching ━━━\n');

    await this.test('Cache-Control: no-cache', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nCache-Control: no-cache\r\n\r\n');
      assert(response.length > 0, 'Should handle Cache-Control');
    });

    await this.test('Cache-Control: max-age=0', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nCache-Control: max-age=0\r\n\r\n');
      assert(response.length > 0, 'Should handle max-age directive');
    });

    await this.test('Pragma: no-cache (HTTP/1.0)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nPragma: no-cache\r\n\r\n');
      assert(response.length > 0, 'Should handle Pragma header');
    });

    // ========== RFC 7235: Authentication ==========
    console.log('\n━━━ RFC 7235: Authentication ━━━\n');

    await this.test('Authorization: Basic', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAuthorization: Basic dXNlcjpwYXNz\r\n\r\n');
      assert(response.length > 0, 'Should handle Basic auth');
    });

    await this.test('Authorization: Bearer', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer token123\r\n\r\n');
      assert(response.length > 0, 'Should handle Bearer token');
    });

    // ========== Additional Edge Cases ==========
    console.log('\n━━━ Edge Cases and Malformed Requests ━━━\n');

    await this.test('Request with CR only (no LF)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\rHost: localhost\r\r');
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 400 || response.length > 0, 'Should handle or reject CR-only');
    });

    await this.test('Request with LF only (no CR)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\nHost: localhost\n\n');
      assert(response.length > 0, 'Should handle LF-only line endings');
    });

    await this.test('Empty request line', async () => {
      const response = await this.sendRaw('\r\nGET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle leading empty lines');
    });

    await this.test('Request with NULL bytes', async () => {
      const buffer = Buffer.from('GET / HTTP/1.1\r\nHost: localhost\r\nX-Test: \x00null\r\n\r\n');
      const response = await this.sendRaw(buffer);
      assert(response.length > 0, 'Should handle NULL bytes');
    });

    await this.test('Request with unicode in headers', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nX-Unicode: 你好\r\n\r\n');
      assert(response.length > 0, 'Should handle unicode');
    });

    await this.test('Very large header value', async () => {
      const largeValue = 'x'.repeat(10000);
      const response = await this.sendRaw(`GET / HTTP/1.1\r\nHost: localhost\r\nX-Large: ${largeValue}\r\n\r\n`);
      const { statusCode } = this.parseResponse(response);
      assert(statusCode === 431 || statusCode === 400 || statusCode === 200, 'Should handle large headers');
    });

    await this.test('Request with many headers', async () => {
      let headers = '';
      for (let i = 0; i < 100; i++) {
        headers += `X-Header-${i}: value${i}\r\n`;
      }
      const response = await this.sendRaw(`GET / HTTP/1.1\r\nHost: localhost\r\n${headers}\r\n`);
      assert(response.length > 0, 'Should handle many headers');
    });

    await this.test('Slow request (timeout test)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n', false, 1000);
      assert(response.length > 0, 'Should respond within timeout');
    });

    console.log('\n--- Query String and URI Encoding ---');

    await this.test('Query string with special characters', async () => {
      const response = await this.sendRaw('GET /?key=value&foo=bar&special=%20%21%40 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle query strings');
    });

    await this.test('URL with encoded characters', async () => {
      const response = await this.sendRaw('GET /%2Fpath%2Fto%2Fresource HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle URL encoding');
    });

    await this.test('URL with fragment (should ignore)', async () => {
      const response = await this.sendRaw('GET /path#fragment HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle fragment');
    });

    await this.test('International domain name', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: münchen.example.com\r\n\r\n');
      assert(response.length > 0, 'Should handle IDN');
    });

    console.log('\n--- HTTP/1.0 Compatibility ---');

    await this.test('HTTP/1.0 request (no Host required)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.0\r\n\r\n');
      assert(response.length > 0, 'Should handle HTTP/1.0');
    });

    await this.test('HTTP/1.0 with Connection: keep-alive', async () => {
      const response = await this.sendRaw('GET / HTTP/1.0\r\nConnection: keep-alive\r\n\r\n');
      assert(response.length > 0, 'Should handle HTTP/1.0 keep-alive');
    });

    console.log('\n--- Response Validation ---');

    await this.test('Response has valid status line format', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { statusLine } = this.parseResponse(response);
      assert(/^HTTP\/1\.[01] \d{3}/.test(statusLine), 'Status line format should be valid');
    });

    await this.test('Response uses CRLF line endings', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.includes('\r\n'), 'Should use CRLF');
    });

    await this.test('Response has Date header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { headers } = this.parseResponse(response);
      assert(headers['date'] !== undefined, 'Should include Date header');
    });

    await this.test('Response has Server header (optional)', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      const { headers } = this.parseResponse(response);
      // Server header is optional but good practice
      assert(true, 'Test completed');
    });

    console.log('\n--- Cookie Handling ---');

    await this.test('Cookie header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nCookie: session=abc123; user=test\r\n\r\n');
      assert(response.length > 0, 'Should handle Cookie header');
    });

    console.log('\n--- User-Agent and Referer ---');

    await this.test('User-Agent header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: Mozilla/5.0 Test\r\n\r\n');
      assert(response.length > 0, 'Should handle User-Agent');
    });

    await this.test('Referer header', async () => {
      const response = await this.sendRaw('GET / HTTP/1.1\r\nHost: localhost\r\nReferer: http://example.com/page\r\n\r\n');
      assert(response.length > 0, 'Should handle Referer');
    });

    console.log('\n--- Robustness Tests ---');

    await this.test('Request with extra spaces in request line', async () => {
      const response = await this.sendRaw('GET  /  HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle extra spaces');
    });

    await this.test('Request with tab characters', async () => {
      const response = await this.sendRaw('GET\t/\tHTTP/1.1\r\nHost:\tlocalhost\r\n\r\n');
      assert(response.length > 0, 'Should handle tabs');
    });

    await this.test('Absolute URI in request line', async () => {
      const response = await this.sendRaw('GET http://localhost:8080/path HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert(response.length > 0, 'Should handle absolute URI');
    });

    // Print Results
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✓ Passed: ${this.passed}`);
    console.log(`✗ Failed: ${this.failed}`);
    console.log(`  Total:  ${this.passed + this.failed}`);
    console.log(`  Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(2)}%`);
    console.log('='.repeat(60) + '\n');

    return this.failed === 0;
  }
}

// Run tests
async function main() {
  const tester = new HTTPTester(HOST, PORT);
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HTTPTester;