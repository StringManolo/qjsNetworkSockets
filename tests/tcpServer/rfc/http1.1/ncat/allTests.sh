#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
run_test() {
    local test_name="$1"
    local request="$2"
    local expected_code="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Run the request and capture response
    response=$(echo -ne "$request" | ncat 127.0.0.1 8080 --no-shutdown 2>/dev/null)
    
    # Extract HTTP status code
    status_code=$(echo "$response" | head -n1 | cut -d' ' -f2)
    
    # Check if test passed
    if [ "$status_code" == "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $test_name (got $status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - $test_name (expected $expected_code, got $status_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "=========================================="
echo "HTTP Server Test Suite"
echo "=========================================="
echo ""

# ============================================
# ORIGINAL METHOD TESTS
# ============================================
echo -e "${YELLOW}ORIGINAL METHOD TESTS${NC}"

run_test "get.sh - Method in lowercase (valid token, not implemented)" \
    "get / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "501"

run_test "gEt.sh - Method with mixed case (valid token, not implemented)" \
    "gEt / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "501"

run_test "GET.sh - Valid GET method" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "200"

run_test "X-GET.sh - Valid method not implemented (501)" \
    "X-GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "501"

run_test "Y-GET.sh - Valid method not implemented (501)" \
    "Y-GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "501"

run_test "malformedGET.sh - Method with space (invalid)" \
    "g et / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "400"

run_test "nonValidGET.sh - Method with invalid characters" \
    "GET<> / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "400"

run_test "weirdValidGET.sh - Method with special characters valid by RFC" \
    "QjS+SpEc1aL-Valid%Method / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" \
    "200"

echo ""

# ============================================
# URI TESTS
# ============================================
echo -e "${YELLOW}URI TESTS${NC}"

run_test "validURI.sh - Valid URI with path and query string" \
    "GET /api/users?id=123&name=test HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

run_test "validURIEncoded.sh - URI with encoded characters" \
    "GET /search?q=hello%20world&filter=%2Ftest HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

run_test "validURISpecialChars.sh - URI with allowed special characters" \
    "GET /path/to/resource-_~.file HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

run_test "malformedURI.sh - URI with spaces (not allowed)" \
    "GET /invalid path HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedURI2.sh - URI with invalid characters" \
    "GET /test<>path HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

echo ""

# ============================================
# PROTOCOL TESTS
# ============================================
echo -e "${YELLOW}PROTOCOL TESTS${NC}"

run_test "validHTTP10.sh - Valid HTTP/1.0" \
    "GET / HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHTTP11.sh - Valid HTTP/1.1" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHTTP20.sh - Valid HTTP/2.0" \
    "GET / HTTP/2.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "nonValidHTTP30.sh - HTTP/3.0 not implemented (501)" \
    "GET / HTTP/3.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "501"

run_test "malformedProtocol.sh - Protocol without version" \
    "GET / HTTP\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedProtocol2.sh - Protocol with incorrect format" \
    "GET / HTTP/1.1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedProtocol3.sh - Protocol in lowercase" \
    "GET / http/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

echo ""

# ============================================
# HEADER TESTS
# ============================================
echo -e "${YELLOW}HEADER TESTS${NC}"

run_test "validHeaders.sh - Multiple valid headers" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: TestClient/1.0\r\nAccept: text/html\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHeaderSpecialChars.sh - Header with special characters in field-name" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Custom-Header_123: value\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHeaderEmptyValue.sh - Header with empty value" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Empty:\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHeaderSpacesInValue.sh - Header with spaces in value" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: Mozilla/5.0 (X11; Linux)\r\nConnection: close\r\n\r\n" \
    "200"

run_test "malformedHeaderNoColon.sh - Header without colon" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nInvalidHeader\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedHeaderSpaceInName.sh - Header with space in field-name" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nInvalid Header: value\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedHeaderInvalidChars.sh - Header with invalid characters in field-name" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Test<>: value\r\nConnection: close\r\n\r\n" \
    "400"

echo ""

# ============================================
# BODY TESTS
# ============================================
echo -e "${YELLOW}BODY TESTS${NC}"

run_test "validPOSTWithBody.sh - POST with Content-Length and body" \
    "POST /api/data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 27\r\nConnection: close\r\n\r\n{\"name\":\"test\",\"value\":123}" \
    "404"

run_test "validPUTWithBody.sh - PUT with body" \
    "PUT /resource/1 HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nContent-Length: 11\r\nConnection: close\r\n\r\nHello World" \
    "404"

run_test "validDELETEWithBody.sh - DELETE with body (allowed by RFC)" \
    "DELETE /resource/1 HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 14\r\nConnection: close\r\n\r\n{\"force\":true}" \
    "404"

run_test "validFatGET.sh - GET with body (fat GET, allowed by RFC 7231)" \
    "GET /search HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 21\r\nConnection: close\r\n\r\n{\"query\":\"test data\"}" \
    "404"

run_test "validPOSTNoBody.sh - POST without body (valid)" \
    "POST /action HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

run_test "validBodyWithEncoding.sh - Body with Content-Encoding" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nContent-Encoding: gzip\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest" \
    "404"

run_test "malformedContentLength.sh - Content-Length non-numeric" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: abc\r\nConnection: close\r\n\r\ntest" \
    "400"

run_test "malformedContentLengthNegative.sh - Content-Length negative" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: -10\r\nConnection: close\r\n\r\ntest" \
    "400"

run_test "incompleteBody.sh - Incomplete body (Content-Length greater than received data)" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 100\r\nConnection: close\r\n\r\nshort" \
    "400"

echo ""

# ============================================
# CHUNKED ENCODING TESTS
# ============================================
echo -e "${YELLOW}CHUNKED ENCODING TESTS${NC}"

run_test "validChunkedEncoding.sh - Multiple chunks" \
    "POST /upload HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n5\r\nHello\r\n6\r\n World\r\n0\r\n\r\n" \
    "404"

run_test "validChunkedSingleChunk.sh - Single chunk" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nD\r\nHello, World!\r\n0\r\n\r\n" \
    "404"

run_test "validChunkedMultipleChunks.sh - Multiple chunks with different sizes" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\nTest\r\n3\r\ning\r\n8\r\n chunked\r\n0\r\n\r\n" \
    "404"

run_test "validChunkedHexUppercase.sh - Hex size in uppercase" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nA\r\n0123456789\r\n0\r\n\r\n" \
    "404"

run_test "validChunkedHexLowercase.sh - Hex size in lowercase" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\na\r\n0123456789\r\n0\r\n\r\n" \
    "404"

run_test "validChunkedEmptyFirstChunk.sh - Starting with zero-size chunk" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n" \
    "404"

run_test "malformedChunkedNoSize.sh - Missing chunk size" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n\r\nHello\r\n0\r\n\r\n" \
    "400"

run_test "malformedChunkedInvalidHex.sh - Invalid hex in chunk size" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nZZ\r\nHello\r\n0\r\n\r\n" \
    "400"

run_test "malformedChunkedIncompleteData.sh - Chunk data shorter than declared size" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nA\r\nShort\r\n0\r\n\r\n" \
    "400"

run_test "malformedChunkedNegativeSize.sh - Negative chunk size" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n-5\r\nHello\r\n0\r\n\r\n" \
    "400"

run_test "malformedChunkedSpaceInSize.sh - Space in chunk size" \
    "POST /data HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n5 \r\nHello\r\n0\r\n\r\n" \
    "400"

echo ""

# ============================================
# REQUIRED HEADERS TESTS
# ============================================
echo -e "${YELLOW}REQUIRED HEADERS TESTS${NC}"

run_test "validHTTP11WithHost.sh - HTTP/1.1 with Host header (required)" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validHTTP10NoHost.sh - HTTP/1.0 without Host header (allowed)" \
    "GET / HTTP/1.0\r\nConnection: close\r\n\r\n" \
    "200"

run_test "malformedHTTP11NoHost.sh - HTTP/1.1 without Host header (invalid)" \
    "GET / HTTP/1.1\r\nConnection: close\r\n\r\n" \
    "400"

run_test "malformedHTTP11EmptyHost.sh - HTTP/1.1 with empty Host header (invalid)" \
    "GET / HTTP/1.1\r\nHost: \r\nConnection: close\r\n\r\n" \
    "400"

run_test "validHTTP11HostWithPort.sh - HTTP/1.1 with Host including port" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1:8080\r\nConnection: close\r\n\r\n" \
    "200"

echo ""

# ============================================
# ROUTING TESTS
# ============================================
echo -e "${YELLOW}ROUTING TESTS${NC}"

run_test "route_home.sh - Home route" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "route_about.sh - About route" \
    "GET /about HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "route_status.sh - Status route" \
    "GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "route_404.sh - Non-existent route" \
    "GET /nonexistent HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

echo ""

# ============================================
# METHOD WITHOUT BODY TESTS
# ============================================
echo -e "${YELLOW}METHOD WITHOUT BODY TESTS${NC}"

run_test "validHEADNoBody.sh - HEAD without body" \
    "HEAD / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validTRACENoBody.sh - TRACE without body" \
    "TRACE / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

echo ""

# ============================================
# QUERY STRING TESTS
# ============================================
echo -e "${YELLOW}QUERY STRING TESTS${NC}"

run_test "validQueryString.sh - Simple query string" \
    "GET /api/echo?name=test&id=123 HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validQueryStringEncoded.sh - Query string with percent encoding" \
    "GET /api/echo?text=hello%20world&path=%2Ftest HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validQueryStringEmpty.sh - Empty query string" \
    "GET /api/echo? HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validQueryStringNoValue.sh - Query parameter without value" \
    "GET /api/echo?flag&debug HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validQueryStringEmptyValue.sh - Query parameter with empty value" \
    "GET /api/echo?key=&name=test HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validQueryStringSpecialChars.sh - Query string with special characters" \
    "GET /api/echo?email=test%40example.com&tag=%23nodejs HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "malformedQueryStringInvalidEncoding.sh - Query string with invalid percent encoding" \
    "GET /api/echo?text=hello%ZZ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "400"

echo ""

# ============================================
# JSON REQUEST/RESPONSE TESTS
# ============================================
echo -e "${YELLOW}JSON REQUEST/RESPONSE TESTS${NC}"

run_test "validJSONRequest.sh - POST with valid JSON" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 27\r\nConnection: close\r\n\r\n{\"name\":\"test\",\"value\":123}" \
    "200"

run_test "validJSONRequestWithWhitespace.sh - POST with JSON containing whitespace" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 36\r\nConnection: close\r\n\r\n{\n  \"name\": \"test\",\n  \"value\": 123\n}" \
    "200"

run_test "validJSONRequestArray.sh - POST with JSON array" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n[1,2,3,4,5]" \
    "200"

run_test "validJSONRequestEmpty.sh - POST with empty JSON object" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}" \
    "200"

run_test "validJSONContentTypeCharset.sh - POST with Content-Type including charset" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: 13\r\nConnection: close\r\n\r\n{\"test\":\"ok\"}" \
    "200"

run_test "malformedJSONRequest.sh - POST with invalid JSON" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 18\r\nConnection: close\r\n\r\n{\"name\":\"test\",}" \
    "400"

run_test "malformedJSONRequestBrokenSyntax.sh - POST with completely broken JSON" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 14\r\nConnection: close\r\n\r\nnot valid json" \
    "400"

run_test "validJSONResponse.sh - GET endpoint that returns JSON" \
    "GET /api/echo?format=json HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

echo ""

# ============================================
# POST FORM PARSING TESTS
# ============================================
echo -e "${YELLOW}POST FORM PARSING TESTS${NC}"

run_test "validFormSimple.sh - POST with simple form data" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 19\r\nConnection: close\r\n\r\nname=test&value=123" \
    "200"

run_test "validFormEncoded.sh - POST with percent-encoded form data" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 42\r\nConnection: close\r\n\r\nemail=test%40example.com&text=hello%20world" \
    "200"

run_test "validFormEmptyValue.sh - POST with empty form value" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 14\r\nConnection: close\r\n\r\nkey=&name=test" \
    "200"

run_test "validFormNoValue.sh - POST with form key without value" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 10\r\nConnection: close\r\n\r\nflag&debug" \
    "200"

run_test "validFormEmpty.sh - POST with empty form body" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 0\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validFormSpecialChars.sh - POST with special characters in form data" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 36\r\nConnection: close\r\n\r\ntag=%23nodejs&symbol=%26%26&plus=%2B" \
    "200"

run_test "malformedFormInvalidEncoding.sh - POST with invalid percent encoding in form" \
    "POST /api/echo HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 14\r\nConnection: close\r\n\r\ntext=hello%ZZ" \
    "400"

echo ""

# ============================================
# STATIC FILE SERVING TESTS
# ============================================
echo -e "${YELLOW}STATIC FILE SERVING TESTS${NC}"

echo -e "${YELLOW}Note: These tests require files in public/ directory${NC}"

run_test "validStaticHTML.sh - Request HTML file" \
    "GET /test.html HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validStaticCSS.sh - Request CSS file" \
    "GET /style.css HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validStaticJS.sh - Request JavaScript file" \
    "GET /script.js HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validStaticJSON.sh - Request JSON file" \
    "GET /data.json HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validStaticTXT.sh - Request text file" \
    "GET /readme.txt HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "validStaticSubdir.sh - Request file in subdirectory" \
    "GET /assets/logo.png HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

run_test "invalidStaticNotFound.sh - Request non-existent file (404)" \
    "GET /nonexistent.html HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "404"

echo ""

# ============================================
# KEEP-ALIVE TESTS
# ============================================
echo -e "${YELLOW}KEEP-ALIVE TESTS${NC}"

run_test "validKeepAlive.sh - Request with Connection: keep-alive" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n" \
    "200"

run_test "validConnectionClose.sh - Request with Connection: close" \
    "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" \
    "200"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests:  ${TOTAL_TESTS}"
echo -e "${GREEN}Passed:       ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed:       ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi
