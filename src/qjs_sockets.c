#include "quickjs.h"
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/epoll.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <stdlib.h>
#include <ctype.h>

#define countof(x) (sizeof(x) / sizeof((x)[0]))
#define MAX_EVENTS 1024
#define MAX_HEADERS 64
#define MAX_HEADER_SIZE 8192

// Socket constants
static const JSCFunctionListEntry js_socket_constants[] = {
  JS_PROP_INT32_DEF("AF_INET", AF_INET, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("AF_INET6", AF_INET6, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SOCK_STREAM", SOCK_STREAM, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SOCK_DGRAM", SOCK_DGRAM, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SOCK_RAW", SOCK_RAW, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("IPPROTO_TCP", IPPROTO_TCP, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("IPPROTO_UDP", IPPROTO_UDP, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SOL_SOCKET", SOL_SOCKET, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_REUSEADDR", SO_REUSEADDR, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_REUSEPORT", SO_REUSEPORT, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_KEEPALIVE", SO_KEEPALIVE, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_RCVBUF", SO_RCVBUF, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_SNDBUF", SO_SNDBUF, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("TCP_NODELAY", TCP_NODELAY, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_RD", SHUT_RD, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_WR", SHUT_WR, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_RDWR", SHUT_RDWR, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("O_NONBLOCK", O_NONBLOCK, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLIN", EPOLLIN, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLOUT", EPOLLOUT, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLERR", EPOLLERR, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLHUP", EPOLLHUP, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLET", EPOLLET, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLLONESHOT", EPOLLONESHOT, JS_PROP_CONFIGURABLE),
};

// setnonblocking(fd)
static JSValue js_setnonblocking(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int fd;
  
  if (JS_ToInt32(ctx, &fd, argv[0]))
    return JS_EXCEPTION;
  
  int flags = fcntl(fd, F_GETFL, 0);
  if (flags < 0)
    return JS_ThrowInternalError(ctx, "fcntl(F_GETFL) failed: %s", strerror(errno));
  
  if (fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0)
    return JS_ThrowInternalError(ctx, "fcntl(F_SETFL) failed: %s", strerror(errno));
  
  return JS_NewInt32(ctx, 0);
}

// epoll_create1(flags)
static JSValue js_epoll_create1(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int flags = 0;
  
  if (argc > 0 && JS_ToInt32(ctx, &flags, argv[0]))
    return JS_EXCEPTION;
  
  int epfd = epoll_create1(flags);
  if (epfd < 0)
    return JS_ThrowInternalError(ctx, "epoll_create1() failed: %s", strerror(errno));
  
  return JS_NewInt32(ctx, epfd);
}

// epoll_ctl(epfd, op, fd, events)
static JSValue js_epoll_ctl(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int epfd, op, fd, events;
  
  if (JS_ToInt32(ctx, &epfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &op, argv[1]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &fd, argv[2]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &events, argv[3]))
    return JS_EXCEPTION;
  
  struct epoll_event ev;
  ev.events = events;
  ev.data.fd = fd;
  
  if (epoll_ctl(epfd, op, fd, &ev) < 0)
    return JS_ThrowInternalError(ctx, "epoll_ctl() failed: %s", strerror(errno));
  
  return JS_NewInt32(ctx, 0);
}

// epoll_wait(epfd, maxevents, timeout) -> array of {fd, events}
static JSValue js_epoll_wait(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int epfd, maxevents, timeout = -1;
  
  if (JS_ToInt32(ctx, &epfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &maxevents, argv[1]))
    return JS_EXCEPTION;
  if (argc > 2 && JS_ToInt32(ctx, &timeout, argv[2]))
    return JS_EXCEPTION;
  
  if (maxevents > MAX_EVENTS)
    maxevents = MAX_EVENTS;
  
  struct epoll_event events[MAX_EVENTS];
  int nfds = epoll_wait(epfd, events, maxevents, timeout);
  
  if (nfds < 0)
    return JS_ThrowInternalError(ctx, "epoll_wait() failed: %s", strerror(errno));
  
  JSValue result = JS_NewArray(ctx);
  for (int i = 0; i < nfds; i++) {
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "fd", JS_NewInt32(ctx, events[i].data.fd));
    JS_SetPropertyStr(ctx, obj, "events", JS_NewUint32(ctx, events[i].events));
    JS_SetPropertyUint32(ctx, result, i, obj);
  }
  
  return result;
}

// socket(domain, type, protocol)
static JSValue js_socket(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int domain, type, protocol = 0;

  if (JS_ToInt32(ctx, &domain, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &type, argv[1]))
    return JS_EXCEPTION;
  if (argc > 2 && JS_ToInt32(ctx, &protocol, argv[2]))
    return JS_EXCEPTION;

  int fd = socket(domain, type, protocol);
  if (fd < 0)
    return JS_ThrowInternalError(ctx, "socket() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, fd);
}

// bind(sockfd, address, port)
static JSValue js_bind(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, port;
  const char *addr;
  struct sockaddr_in sa;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  addr = JS_ToCString(ctx, argv[1]);
  if (!addr)
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &port, argv[2])) {
    JS_FreeCString(ctx, addr);
    return JS_EXCEPTION;
  }

  memset(&sa, 0, sizeof(sa));
  sa.sin_family = AF_INET;
  sa.sin_port = htons(port);

  if (strcmp(addr, "0.0.0.0") == 0 || strcmp(addr, "") == 0) {
    sa.sin_addr.s_addr = INADDR_ANY;
  } else {
    if (inet_pton(AF_INET, addr, &sa.sin_addr) <= 0) {
      JS_FreeCString(ctx, addr);
      return JS_ThrowInternalError(ctx, "Invalid address: %s", addr);
    }
  }
  JS_FreeCString(ctx, addr);

  if (bind(sockfd, (struct sockaddr *)&sa, sizeof(sa)) < 0)
    return JS_ThrowInternalError(ctx, "bind() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, 0);
}

// listen(sockfd, backlog)
static JSValue js_listen(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, backlog;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &backlog, argv[1]))
    return JS_EXCEPTION;

  if (listen(sockfd, backlog) < 0)
    return JS_ThrowInternalError(ctx, "listen() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, 0);
}

// accept(sockfd) -> {fd, address, port}
static JSValue js_accept(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd;
  struct sockaddr_in sa;
  socklen_t len = sizeof(sa);

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;

  int client_fd = accept(sockfd, (struct sockaddr *)&sa, &len);
  if (client_fd < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK)
      return JS_NULL;
    return JS_ThrowInternalError(ctx, "accept() failed: %s", strerror(errno));
  }

  char addr_str[INET_ADDRSTRLEN];
  inet_ntop(AF_INET, &sa.sin_addr, addr_str, sizeof(addr_str));

  JSValue obj = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, obj, "fd", JS_NewInt32(ctx, client_fd));
  JS_SetPropertyStr(ctx, obj, "address", JS_NewString(ctx, addr_str));
  JS_SetPropertyStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(sa.sin_port)));

  return obj;
}

// connect(sockfd, address, port)
static JSValue js_connect(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, port;
  const char *addr;
  struct sockaddr_in sa;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  addr = JS_ToCString(ctx, argv[1]);
  if (!addr)
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &port, argv[2])) {
    JS_FreeCString(ctx, addr);
    return JS_EXCEPTION;
  }

  memset(&sa, 0, sizeof(sa));
  sa.sin_family = AF_INET;
  sa.sin_port = htons(port);

  if (inet_pton(AF_INET, addr, &sa.sin_addr) <= 0) {
    JS_FreeCString(ctx, addr);
    return JS_ThrowInternalError(ctx, "Invalid address: %s", addr);
  }
  JS_FreeCString(ctx, addr);

  if (connect(sockfd, (struct sockaddr *)&sa, sizeof(sa)) < 0) {
    if (errno != EINPROGRESS)
      return JS_ThrowInternalError(ctx, "connect() failed: %s", strerror(errno));
  }

  return JS_NewInt32(ctx, 0);
}

// send(sockfd, data, flags)
static JSValue js_send(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, flags = 0;
  size_t len;
  const char *data;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;

  if (JS_IsString(argv[1])) {
    data = JS_ToCStringLen(ctx, &len, argv[1]);
    if (!data)
      return JS_EXCEPTION;
  } else {
    return JS_ThrowTypeError(ctx, "Data must be a string");
  }

  if (argc > 2 && JS_ToInt32(ctx, &flags, argv[2])) {
    JS_FreeCString(ctx, data);
    return JS_EXCEPTION;
  }

  ssize_t sent = send(sockfd, data, len, flags | MSG_NOSIGNAL);
  JS_FreeCString(ctx, data);

  if (sent < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK)
      return JS_NewInt32(ctx, 0);
    return JS_ThrowInternalError(ctx, "send() failed: %s", strerror(errno));
  }

  return JS_NewInt32(ctx, sent);
}

// recv(sockfd, bufsize, flags)
static JSValue js_recv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, bufsize, flags = 0;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &bufsize, argv[1]))
    return JS_EXCEPTION;
  if (argc > 2 && JS_ToInt32(ctx, &flags, argv[2]))
    return JS_EXCEPTION;

  char *buf = malloc(bufsize);
  if (!buf)
    return JS_ThrowOutOfMemory(ctx);

  ssize_t received = recv(sockfd, buf, bufsize, flags);

  if (received < 0) {
    free(buf);
    if (errno == EAGAIN || errno == EWOULDBLOCK)
      return JS_NewStringLen(ctx, "", 0);
    return JS_ThrowInternalError(ctx, "recv() failed: %s", strerror(errno));
  }

  JSValue result = JS_NewStringLen(ctx, buf, received);
  free(buf);

  return result;
}

// close(fd)
static JSValue js_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int fd;

  if (JS_ToInt32(ctx, &fd, argv[0]))
    return JS_EXCEPTION;

  if (close(fd) < 0)
    return JS_ThrowInternalError(ctx, "close() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, 0);
}

// setsockopt(sockfd, level, optname, optval)
static JSValue js_setsockopt(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, level, optname, optval;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &level, argv[1]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &optname, argv[2]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &optval, argv[3]))
    return JS_EXCEPTION;

  if (setsockopt(sockfd, level, optname, &optval, sizeof(optval)) < 0)
    return JS_ThrowInternalError(ctx, "setsockopt() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, 0);
}

// shutdown(sockfd, how)
static JSValue js_shutdown(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int sockfd, how;

  if (JS_ToInt32(ctx, &sockfd, argv[0]))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &how, argv[1]))
    return JS_EXCEPTION;

  if (shutdown(sockfd, how) < 0)
    return JS_ThrowInternalError(ctx, "shutdown() failed: %s", strerror(errno));

  return JS_NewInt32(ctx, 0);
}

// gethostbyname(hostname) -> address
static JSValue js_gethostbyname(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  const char *hostname = JS_ToCString(ctx, argv[0]);
  if (!hostname)
    return JS_EXCEPTION;

  struct hostent *he = gethostbyname(hostname);
  JS_FreeCString(ctx, hostname);

  if (!he)
    return JS_ThrowInternalError(ctx, "gethostbyname() failed");

  char *addr = inet_ntoa(*(struct in_addr *)he->h_addr);
  return JS_NewString(ctx, addr);
}

// HTTP Parser helpers
static inline char *skip_whitespace(char *p) {
  while (*p == ' ' || *p == '\t') p++;
  return p;
}

static inline char *find_eol(char *p) {
  while (*p && *p != '\r' && *p != '\n') p++;
  return p;
}

static void url_decode(char *dst, const char *src) {
  while (*src) {
    if (*src == '%' && isxdigit(src[1]) && isxdigit(src[2])) {
      int c1 = tolower(src[1]);
      int c2 = tolower(src[2]);
      c1 = c1 <= '9' ? c1 - '0' : c1 - 'a' + 10;
      c2 = c2 <= '9' ? c2 - '0' : c2 - 'a' + 10;
      *dst++ = (c1 << 4) | c2;
      src += 3;
    } else if (*src == '+') {
      *dst++ = ' ';
      src++;
    } else {
      *dst++ = *src++;
    }
  }
  *dst = '\0';
}

// parse_http_request(data) -> {method, url, path, query, headers, body}
static JSValue js_parse_http_request(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  size_t data_len;
  const char *data = JS_ToCStringLen(ctx, &data_len, argv[0]);
  if (!data)
    return JS_EXCEPTION;

  JSValue result = JS_NewObject(ctx);
  JSValue headers = JS_NewObject(ctx);
  JSValue query = JS_NewObject(ctx);

  const char *p = data;
  const char *end = data + data_len;
  
  // Parse request line: METHOD URL HTTP/1.1
  const char *method_start = p;
  while (p < end && *p != ' ') p++;
  if (p >= end) goto error;
  
  JS_SetPropertyStr(ctx, result, "method", JS_NewStringLen(ctx, method_start, p - method_start));
  p++; // skip space
  
  // Parse URL
  const char *url_start = p;
  while (p < end && *p != ' ') p++;
  if (p >= end) goto error;
  
  size_t url_len = p - url_start;
  char *url_copy = malloc(url_len + 1);
  memcpy(url_copy, url_start, url_len);
  url_copy[url_len] = '\0';
  
  // Split URL into path and query
  char *query_sep = strchr(url_copy, '?');
  if (query_sep) {
    *query_sep = '\0';
    char *query_str = query_sep + 1;
    
    // Parse query string
    char *q = query_str;
    while (*q) {
      char *key_start = q;
      char *eq = strchr(q, '=');
      char *amp = strchr(q, '&');
      
      if (!amp) amp = q + strlen(q);
      
      if (eq && eq < amp) {
        *eq = '\0';
        if (*amp) *amp = '\0';
        
        char decoded_key[256], decoded_value[2048];
        url_decode(decoded_key, key_start);
        url_decode(decoded_value, eq + 1);
        
        JS_SetPropertyStr(ctx, query, decoded_key, JS_NewString(ctx, decoded_value));
        q = *amp ? amp + 1 : amp;
      } else {
        if (*amp) *amp = '\0';
        
        char decoded_key[256];
        url_decode(decoded_key, key_start);
        JS_SetPropertyStr(ctx, query, decoded_key, JS_NewString(ctx, ""));
        q = *amp ? amp + 1 : amp;
      }
    }
  }
  
  JS_SetPropertyStr(ctx, result, "url", JS_NewString(ctx, url_copy));
  JS_SetPropertyStr(ctx, result, "path", JS_NewString(ctx, url_copy));
  JS_SetPropertyStr(ctx, result, "query", query);
  free(url_copy);
  
  // Skip to end of request line
  while (p < end && *p != '\n') p++;
  if (p >= end) goto error;
  p++; // skip \n
  
  // Parse headers
  int content_length = 0;
  char content_type[128] = {0};
  
  while (p < end) {
    // Check for empty line (end of headers)
    if (*p == '\r' && p + 1 < end && *(p + 1) == '\n') {
      p += 2; // skip \r\n
      break;
    }
    if (*p == '\n') {
      p++;
      break;
    }
    
    // Parse header
    const char *header_name_start = p;
    while (p < end && *p != ':') p++;
    if (p >= end) break;
    
    size_t header_name_len = p - header_name_start;
    char header_name[256];
    if (header_name_len >= sizeof(header_name)) header_name_len = sizeof(header_name) - 1;
    
    // Copy and lowercase header name
    for (size_t i = 0; i < header_name_len; i++) {
      header_name[i] = tolower(header_name_start[i]);
    }
    header_name[header_name_len] = '\0';
    
    p++; // skip ':'
    while (p < end && (*p == ' ' || *p == '\t')) p++; // skip whitespace
    
    const char *value_start = p;
    while (p < end && *p != '\r' && *p != '\n') p++;
    
    size_t value_len = p - value_start;
    
    // Track special headers
    if (strcmp(header_name, "content-length") == 0) {
      char len_str[32];
      if (value_len < sizeof(len_str)) {
        memcpy(len_str, value_start, value_len);
        len_str[value_len] = '\0';
        content_length = atoi(len_str);
      }
    } else if (strcmp(header_name, "content-type") == 0) {
      if (value_len < sizeof(content_type)) {
        memcpy(content_type, value_start, value_len);
        content_type[value_len] = '\0';
      }
    }
    
    JS_SetPropertyStr(ctx, headers, header_name, JS_NewStringLen(ctx, value_start, value_len));
    
    // Skip to next line
    if (p < end && *p == '\r') p++;
    if (p < end && *p == '\n') p++;
  }
  
  JS_SetPropertyStr(ctx, result, "headers", headers);
  
  // Parse body (p now points to start of body)
  if (content_length > 0 && p < end) {
    size_t available = end - p;
    size_t body_len = content_length < available ? content_length : available;
    
    // Check if it's JSON
    if (strstr(content_type, "application/json")) {
      // Try to parse as JSON
      JSValue json_val = JS_ParseJSON(ctx, p, body_len, "<body>");
      if (!JS_IsException(json_val)) {
        JS_SetPropertyStr(ctx, result, "body", json_val);
      } else {
        // Fall back to string if JSON parsing fails
        JS_FreeValue(ctx, json_val);
        JS_SetPropertyStr(ctx, result, "body", JS_NewStringLen(ctx, p, body_len));
      }
    } else {
      JS_SetPropertyStr(ctx, result, "body", JS_NewStringLen(ctx, p, body_len));
    }
  } else {
    JS_SetPropertyStr(ctx, result, "body", JS_NewString(ctx, ""));
  }
  
  JS_FreeCString(ctx, data);
  return result;

error:
  JS_FreeCString(ctx, data);
  JS_FreeValue(ctx, headers);
  JS_FreeValue(ctx, query);
  JS_FreeValue(ctx, result);
  return JS_ThrowInternalError(ctx, "Invalid HTTP request");
}

static const JSCFunctionListEntry js_socket_funcs[] = {
  JS_CFUNC_DEF("socket", 3, js_socket),
  JS_CFUNC_DEF("bind", 3, js_bind),
  JS_CFUNC_DEF("listen", 2, js_listen),
  JS_CFUNC_DEF("accept", 1, js_accept),
  JS_CFUNC_DEF("connect", 3, js_connect),
  JS_CFUNC_DEF("send", 3, js_send),
  JS_CFUNC_DEF("recv", 3, js_recv),
  JS_CFUNC_DEF("close", 1, js_close),
  JS_CFUNC_DEF("setsockopt", 4, js_setsockopt),
  JS_CFUNC_DEF("shutdown", 2, js_shutdown),
  JS_CFUNC_DEF("gethostbyname", 1, js_gethostbyname),
  JS_CFUNC_DEF("setnonblocking", 1, js_setnonblocking),
  JS_CFUNC_DEF("epoll_create1", 1, js_epoll_create1),
  JS_CFUNC_DEF("epoll_ctl", 4, js_epoll_ctl),
  JS_CFUNC_DEF("epoll_wait", 3, js_epoll_wait),
  JS_CFUNC_DEF("parse_http_request", 1, js_parse_http_request),
  JS_PROP_INT32_DEF("EPOLL_CTL_ADD", EPOLL_CTL_ADD, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLL_CTL_MOD", EPOLL_CTL_MOD, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("EPOLL_CTL_DEL", EPOLL_CTL_DEL, JS_PROP_CONFIGURABLE),
};

static int js_sockets_init(JSContext *ctx, JSModuleDef *m) {
  JSValue sockets = JS_NewObject(ctx);
  JS_SetPropertyFunctionList(ctx, sockets, js_socket_funcs, countof(js_socket_funcs));
  JS_SetPropertyFunctionList(ctx, sockets, js_socket_constants, countof(js_socket_constants));
  JS_SetModuleExport(ctx, m, "default", sockets);
  return 0;
}

JSModuleDef *js_init_module(JSContext *ctx, const char *module_name) {
  JSModuleDef *m = JS_NewCModule(ctx, module_name, js_sockets_init);
  if (!m)
    return NULL;
  JS_AddModuleExport(ctx, m, "default");
  return m;
}
