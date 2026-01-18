# apache2-utils

### Sync qjs sockets express:
> $ ab -n 10000 -c 100 http://127.0.0.1:8080/
```
This is ApacheBench, Version 2.3 <$Revision: 1923142 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 1000 requests
Completed 2000 requests
Completed 3000 requests
Completed 4000 requests
Completed 5000 requests
Completed 6000 requests
Completed 7000 requests
Completed 8000 requests
Completed 9000 requests
Completed 10000 requests
Finished 10000 requests


Server Software:
Server Hostname:        127.0.0.1
Server Port:            8080

Document Path:          /
Document Length:        9 bytes

Concurrency Level:      100
Time taken for tests:   28.084 seconds
Complete requests:      10000
Failed requests:        0
Non-2xx responses:      10000
Total transferred:      1130000 bytes
HTML transferred:       90000 bytes
Requests per second:    356.07 [#/sec] (mean)
Time per request:       280.840 [ms] (mean)
Time per request:       2.808 [ms] (mean, across all concurrent requests)
Transfer rate:          39.29 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        1  129 493.6     59    6166
Processing:    27  149 490.6     89    6659
Waiting:       21  118 431.2     60    6269
Total:         92  278 856.5    158    8895

Percentage of the requests served within a certain time (ms)
  50%    158
  66%    183
  75%    189
  80%    193
  90%    209
  95%    247
  98%   2247
  99%   5658
 100%   8895 (longest request)
 ```

### Async qjs sockets express:
```
$ ab -n 10000 -c 100 http://127.0.0.1:8080/
This is ApacheBench, Version 2.3 <$Revision: 1923142 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 1000 requests
Completed 2000 requests
Completed 3000 requests
Completed 4000 requests
Completed 5000 requests
Completed 6000 requests
Completed 7000 requests
Completed 8000 requests
Completed 9000 requests
Completed 10000 requests
Finished 10000 requests


Server Software:
Server Hostname:        127.0.0.1
Server Port:            8080

Document Path:          /
Document Length:        9 bytes

Concurrency Level:      100
Time taken for tests:   23.955 seconds
Complete requests:      10000
Failed requests:        0
Non-2xx responses:      10000
Total transferred:      1130000 bytes
HTML transferred:       90000 bytes
Requests per second:    417.45 [#/sec] (mean)
Time per request:       239.550 [ms] (mean)
Time per request:       2.395 [ms] (mean, across all concurrent requests)
Transfer rate:          46.07 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        1  105 306.4     65    5169
Processing:    31  132 383.7     92    5470
Waiting:       24  103 326.5     63    5271
Total:         94  237 569.4    177    5939

Percentage of the requests served within a certain time (ms)
  50%    177
  66%    187
  75%    193
  80%    196
  90%    207
  95%    282
  98%   1960
  99%   3352
 100%   5939 (longest request)
 ```

### Async node express:
```
$ ab -n 10000 -c 100 http://127.0.0.1:8080/
This is ApacheBench, Version 2.3 <$Revision: 1923142 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 1000 requests
Completed 2000 requests
Completed 3000 requests
Completed 4000 requests
Completed 5000 requests
Completed 6000 requests
Completed 7000 requests
Completed 8000 requests
Completed 9000 requests
Completed 10000 requests
Finished 10000 requests


Server Software:
Server Hostname:        127.0.0.1
Server Port:            8080

Document Path:          /
Document Length:        139 bytes

Concurrency Level:      100
Time taken for tests:   35.734 seconds
Complete requests:      10000
Failed requests:        0
Non-2xx responses:      10000
Total transferred:      3830000 bytes
HTML transferred:       1390000 bytes
Requests per second:    279.84 [#/sec] (mean)
Time per request:       357.344 [ms] (mean)
Time per request:       3.573 [ms] (mean, across all concurrent requests)
Transfer rate:          104.67 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0   17 160.6      1    1777
Processing:   113  336  60.7    343    1759
Waiting:       47  334  60.2    341    1746
Total:        236  353 172.7    344    2152

Percentage of the requests served within a certain time (ms)
  50%    344
  66%    355
  75%    359
  80%    363
  90%    373
  95%    392
  98%    420
  99%   1843
 100%   2152 (longest request)
```


