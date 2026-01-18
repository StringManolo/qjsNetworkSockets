if [ ! -e "./lib/quickjs.h" ]; then
  curl -LO https://bellard.org/quickjs/quickjs-2025-09-13-2.tar.xz --silent
  tar -xf quickjs-2025-09-13-2.tar.xz
  mv quickjs-2025-09-13/quickjs.h ./lib/
  rm quickjs-2025-09-13* -rf
fi

gcc -shared -fPIC -o ./dist/network_sockets.so ./src/qjs_sockets.c -I ./lib/ && echo "Done"


