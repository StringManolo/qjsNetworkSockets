echo -ne "X-GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUser-Agent: raw\r\nConnection: close\r\n\r\n" | ncat 127.0.0.1 8080 --no-shutdown
