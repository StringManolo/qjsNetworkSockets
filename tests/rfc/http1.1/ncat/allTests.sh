# ============================================
# ORIGINAL METHOD TESTS
# ============================================

# get.sh - Method in lowercase (invalid)
echo -ne "get / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# gEt.sh - Method with mixed case (invalid)
echo -ne "gEt / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# GET.sh - Valid GET method
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# X-GET.sh - Valid method not implemented (501)
echo -ne "X-GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# Y-GET.sh - Valid method not implemented (501)
echo -ne "Y-GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedGET.sh - Method with space (invalid)
echo -ne "g et / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedGET2.sh - Method with space (invalid)
echo -ne "g et / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# nonValidGET.sh - Method with invalid characters
echo -ne "GET<> / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# weirdValidGET.sh - Method with special characters valid by RFC
echo -ne "QjS+SpEc1aL-Valid%Method / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# ============================================
# URI TESTS
# ============================================

# validURI.sh - Valid URI with path and query string
echo -ne "GET /api/users?id=123&name=test HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validURIEncoded.sh - URI with encoded characters
echo -ne "GET /search?q=hello%20world&filter=%2Ftest HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validURISpecialChars.sh - URI with allowed special characters
echo -ne "GET /path/to/resource-_~.file HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedURI.sh - URI with spaces (not allowed)
echo -ne "GET /invalid path HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedURI2.sh - URI with invalid characters
echo -ne "GET /test<>path HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# ============================================
# PROTOCOL TESTS
# ============================================

# validHTTP10.sh - Valid HTTP/1.0
echo -ne "GET / HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validHTTP11.sh - Valid HTTP/1.1
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validHTTP20.sh - Valid HTTP/2.0
echo -ne "GET / HTTP/2.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# nonValidHTTP30.sh - HTTP/3.0 not implemented (501)
echo -ne "GET / HTTP/3.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedProtocol.sh - Protocol without version
echo -ne "GET / HTTP\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedProtocol2.sh - Protocol with incorrect format
echo -ne "GET / HTTP/1.1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedProtocol3.sh - Protocol in lowercase
echo -ne "GET / http/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# ============================================
# HEADER TESTS
# ============================================

# validHeaders.sh - Multiple valid headers
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: TestClient/1.0\r\nAccept: text/html\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validHeaderSpecialChars.sh - Header with special characters in field-name
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Custom-Header_123: value\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validHeaderEmptyValue.sh - Header with empty value
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Empty:\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validHeaderSpacesInValue.sh - Header with spaces in value
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: Mozilla/5.0 (X11; Linux)\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedHeaderNoColon.sh - Header without colon
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nInvalidHeader\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedHeaderSpaceInName.sh - Header with space in field-name
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nInvalid Header: value\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedHeaderInvalidChars.sh - Header with invalid characters in field-name
echo -ne "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Test<>: value\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# ============================================
# BODY TESTS
# ============================================

# validPOSTWithBody.sh - POST with Content-Length and body
echo -ne "POST /api/data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 27\r\nConnection: close\r\n\r\n{\"name\":\"test\",\"value\":123}" | ncat 127.0.0.1 8080 --no-shutdown

# validPUTWithBody.sh - PUT with body
echo -ne "PUT /resource/1 HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nContent-Length: 11\r\nConnection: close\r\n\r\nHello World" | ncat 127.0.0.1 8080 --no-shutdown

# validDELETEWithBody.sh - DELETE with body (allowed by RFC)
echo -ne "DELETE /resource/1 HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"force\":true}" | ncat 127.0.0.1 8080 --no-shutdown

# validFatGET.sh - GET with body (fat GET, allowed by RFC 7231)
echo -ne "GET /search HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 22\r\nConnection: close\r\n\r\n{\"query\":\"test data\"}" | ncat 127.0.0.1 8080 --no-shutdown

# validPOSTNoBody.sh - POST without body (valid)
echo -ne "POST /action HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validBodyWithEncoding.sh - Body with Content-Encoding
echo -ne "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nContent-Encoding: gzip\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest" | ncat 127.0.0.1 8080 --no-shutdown

# validChunkedEncoding.sh - Transfer-Encoding chunked
echo -ne "POST /upload HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n5\r\nHello\r\n6\r\n World\r\n0\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# malformedContentLength.sh - Content-Length non-numeric
echo -ne "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: abc\r\nConnection: close\r\n\r\ntest" | ncat 127.0.0.1 8080 --no-shutdown

# malformedContentLengthNegative.sh - Content-Length negative
echo -ne "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: -10\r\nConnection: close\r\n\r\ntest" | ncat 127.0.0.1 8080 --no-shutdown

# incompleteBody.sh - Incomplete body (Content-Length greater than received data)
echo -ne "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 100\r\nConnection: close\r\n\r\nshort" | ncat 127.0.0.1 8080 --no-shutdown

# validHEADNoBody.sh - HEAD without body (correct, HEAD does not allow body)
echo -ne "HEAD / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown

# validTRACENoBody.sh - TRACE without body (correct, TRACE does not allow body)
echo -ne "TRACE / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown
