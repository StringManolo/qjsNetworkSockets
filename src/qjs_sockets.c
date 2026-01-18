#include "quickjs.h"
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <stdlib.h>

#define countof(x) (sizeof(x) / sizeof((x)[0]))

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
  JS_PROP_INT32_DEF("SO_KEEPALIVE", SO_KEEPALIVE, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_RCVBUF", SO_RCVBUF, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SO_SNDBUF", SO_SNDBUF, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("TCP_NODELAY", TCP_NODELAY, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_RD", SHUT_RD, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_WR", SHUT_WR, JS_PROP_CONFIGURABLE),
  JS_PROP_INT32_DEF("SHUT_RDWR", SHUT_RDWR, JS_PROP_CONFIGURABLE),
};

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
  if (client_fd < 0)
    return JS_ThrowInternalError(ctx, "accept() failed: %s", strerror(errno));

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

  if (connect(sockfd, (struct sockaddr *)&sa, sizeof(sa)) < 0)
    return JS_ThrowInternalError(ctx, "connect() failed: %s", strerror(errno));

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

  ssize_t sent = send(sockfd, data, len, flags);
  JS_FreeCString(ctx, data);

  if (sent < 0)
    return JS_ThrowInternalError(ctx, "send() failed: %s", strerror(errno));

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
