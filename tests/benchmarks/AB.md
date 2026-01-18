# apache2-utils

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

### Async qjs sockets express Keep-Alive cluster (6 instances):
 ```
ab -n 10000 -c 100 -k http://127.0.0.1:8080/
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


Server Software:        qjs-express/1.0
Server Hostname:        127.0.0.1
Server Port:            8080

Document Path:          /
Document Length:        9 bytes

Concurrency Level:      100
Time taken for tests:   4.884 seconds
Complete requests:      10000
Failed requests:        0
Non-2xx responses:      10000
Keep-Alive requests:    10000
Total transferred:      2130000 bytes
HTML transferred:       90000 bytes
Requests per second:    2047.70 [#/sec] (mean)
Time per request:       48.835 [ms] (mean)
Time per request:       0.488 [ms] (mean, across all concurrent requests)
Transfer rate:          425.94 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0   17 173.2      0    1868
Processing:     1   30  52.8     28    1857
Waiting:        1   30  49.5     28    1857
Total:          1   47 188.1     28    1952

Percentage of the requests served within a certain time (ms)
  50%     28
  66%     34
  75%     38
  80%     40
  90%     50
  95%     65
  98%     86
  99%   1857
 100%   1952 (longest request) 
 ```

### Async node express Keep-Alive:
 ```
$ ab -n 10000 -c 100 -k http://127.0.0.1:8080/
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
Time taken for tests:   14.963 seconds
Complete requests:      10000
Failed requests:        0
Non-2xx responses:      10000
Keep-Alive requests:    10000
Total transferred:      4110000 bytes
HTML transferred:       1390000 bytes
Requests per second:    668.30 [#/sec] (mean)
Time per request:       149.633 [ms] (mean)
Time per request:       1.496 [ms] (mean, across all concurrent requests)
Transfer rate:          268.23 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0   16 170.1      0    1867
Processing:    51  131  63.2    115    1856
Waiting:       51  131  60.8    115    1856
Total:         65  147 191.1    116    2146

Percentage of the requests served within a certain time (ms)
  50%    116
  66%    124
  75%    136
  80%    147
  90%    182
  95%    194
  98%    235
  99%   1856
 100%   2146 (longest request)
 ```

