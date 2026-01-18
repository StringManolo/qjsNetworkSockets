# Benchmark Report
**Date:** Sun Jan 18 01:32:37 PM UTC 2026  
**Machine:** Linux localhost 6.17.0-PRoot-Distro #1 SMP PREEMPT_DYNAMIC Fri, 10 Oct 2025 00:00:00 +0000 aarch64 GNU/Linux  
**Test Duration:** 30 seconds per test  
**Total Requests per Test:** 10000  

## Test Configuration
- **Concurrency Levels:** 1 10 50 100 200
- **Endpoints Tested:** /api/users /api/users/1
- **Methods Tested:** GET

## Performance Summary

### By Server Type
| Server Type | Workers | Concurrency | Avg RPS | Max RPS | Avg Latency | Min Latency | Avg RAM (MB) | Efficiency (RPS/MB) |
|-------------|---------|-------------|---------|---------|-------------|-------------|--------------|---------------------|
| node | 1 | 1 | 450.0 | 450.7 | 2.2 | 2.2 | 91.6 | 4.8 |
| node | 1 | 10 | 608.9 | 613.5 | 16.4 | 16.3 | 90.4 | 6.7 |
| node | 1 | 50 | 701.7 | 708.7 | 71.3 | 70.6 | 92.2 | 7.6 |
| node | 1 | 100 | 697.8 | 700.1 | 143.3 | 142.8 | 92.7 | 7.5 |
| node | 1 | 200 | 686.1 | 688.6 | 291.5 | 290.5 | 94.9 | 7.2 |
| qjs_cluster | 1 | 10 | 1106.0 | 1134.9 | 9.0 | 8.8 | 1.5 | 737.3 |
| qjs_cluster | 1 | 50 | 1155.2 | 1173.5 | 43.3 | 42.6 | 1.5 | 770.1 |
| qjs_cluster | 1 | 100 | 1265.0 | 1408.6 | 80.1 | 71.0 | 1.6 | 799.3 |
| qjs_cluster | 1 | 200 | 1247.8 | 1364.8 | 161.7 | 146.5 | 1.7 | 734.0 |
| qjs_cluster | 2 | 1 | 668.7 | 719.4 | 1.5 | 1.4 | 3.1 | 215.7 |
| qjs_cluster | 2 | 10 | 2481.2 | 2634.2 | 4.0 | 3.8 | 3.1 | 800.4 |
| qjs_cluster | 2 | 50 | 2562.7 | 2737.9 | 19.6 | 18.3 | 3.1 | 826.6 |
| qjs_cluster | 2 | 100 | 2430.5 | 2678.7 | 41.6 | 37.3 | 3.1 | 784.0 |
| qjs_cluster | 2 | 200 | 2318.6 | 2583.4 | 87.4 | 77.4 | 3.3 | 710.0 |
| qjs_cluster | 4 | 1 | 725.3 | 725.3 | 1.4 | 1.4 | 6.2 | 116.9 |
| qjs_cluster | 4 | 50 | 3493.7 | 3680.8 | 14.4 | 13.6 | 6.2 | 563.5 |
| qjs_cluster | 4 | 100 | 3311.1 | 3507.6 | 30.3 | 28.5 | 6.2 | 534.0 |
| qjs_cluster | 4 | 200 | 3212.7 | 3547.6 | 62.9 | 56.4 | 6.2 | 518.1 |
| qjs_cluster | 8 | 1 | 691.9 | 691.9 | 1.4 | 1.4 | 12.5 | 55.3 |
| qjs_cluster | 8 | 50 | 4139.3 | 4433.4 | 12.1 | 11.3 | 12.5 | 331.1 |
| qjs_cluster | 8 | 100 | 4049.1 | 4472.7 | 25.0 | 22.4 | 12.5 | 323.9 |
| qjs_cluster | 8 | 200 | 3746.4 | 3904.0 | 53.5 | 51.2 | 12.5 | 299.7 |
| qjs_single | 1 | 1 | 633.4 | 633.4 | 1.6 | 1.6 | 1.5 | 422.2 |
| qjs_single | 1 | 10 | 1066.3 | 1089.2 | 9.4 | 9.2 | 1.5 | 710.8 |
| qjs_single | 1 | 50 | 1157.3 | 1184.8 | 43.2 | 42.2 | 1.5 | 771.5 |
| qjs_single | 1 | 100 | 1276.1 | 1375.7 | 78.8 | 72.7 | 1.6 | 804.5 |
| qjs_single | 1 | 200 | 1205.6 | 1280.6 | 166.5 | 156.2 | 1.7 | 709.1 |

### Detailed Results
| Test Label | Server | Workers | Concurrency | Endpoint | Method | RPS | Latency (ms) | RAM (MB) | Efficiency |
|------------|--------|---------|-------------|----------|--------|-----|--------------|----------|------------|
| node_GET_1c__api_users | node | 1 | 1 | /api/users | GET | 449.2 | 2.2 | 91.9 | 4.8 |
| node_GET_1c__api_users_1 | node | 1 | 1 | /api/users/1 | GET | 450.7 | 2.2 | 91.2 | 4.9 |
| node_GET_10c__api_users | node | 1 | 10 | /api/users | GET | 613.5 | 16.3 | 90.6 | 6.7 |
| node_GET_10c__api_users_1 | node | 1 | 10 | /api/users/1 | GET | 604.3 | 16.5 | 90.3 | 6.6 |
| node_GET_50c__api_users | node | 1 | 50 | /api/users | GET | 708.7 | 70.6 | 91.6 | 7.7 |
| node_GET_50c__api_users_1 | node | 1 | 50 | /api/users/1 | GET | 694.7 | 72.0 | 92.9 | 7.4 |
| node_GET_100c__api_users | node | 1 | 100 | /api/users | GET | 700.1 | 142.8 | 92.2 | 7.5 |
| node_GET_100c__api_users_1 | node | 1 | 100 | /api/users/1 | GET | 695.5 | 143.8 | 93.1 | 7.4 |
| node_GET_200c__api_users | node | 1 | 200 | /api/users | GET | 683.5 | 292.6 | 93.4 | 7.3 |
| node_GET_200c__api_users_1 | node | 1 | 200 | /api/users/1 | GET | 688.6 | 290.5 | 96.4 | 7.1 |
| qjs_single_GET_1c__api_users_1 | qjs_single | 1 | 1 | /api/users/1 | GET | 633.4 | 1.6 | 1.5 | 422.2 |
| qjs_single_GET_10c__api_users | qjs_single | 1 | 10 | /api/users | GET | 1089.2 | 9.2 | 1.5 | 726.1 |
| qjs_single_GET_10c__api_users_1 | qjs_single | 1 | 10 | /api/users/1 | GET | 1043.3 | 9.6 | 1.5 | 695.5 |
| qjs_single_GET_50c__api_users | qjs_single | 1 | 50 | /api/users | GET | 1184.8 | 42.2 | 1.5 | 789.8 |
| qjs_single_GET_50c__api_users_1 | qjs_single | 1 | 50 | /api/users/1 | GET | 1129.8 | 44.3 | 1.5 | 753.2 |
| qjs_single_GET_100c__api_users | qjs_single | 1 | 100 | /api/users | GET | 1375.7 | 72.7 | 1.5 | 917.1 |
| qjs_single_GET_100c__api_users_1 | qjs_single | 1 | 100 | /api/users/1 | GET | 1176.5 | 85.0 | 1.7 | 692.0 |
| qjs_single_GET_200c__api_users | qjs_single | 1 | 200 | /api/users | GET | 1280.6 | 156.2 | 1.7 | 753.2 |
| qjs_single_GET_200c__api_users_1 | qjs_single | 1 | 200 | /api/users/1 | GET | 1130.6 | 176.9 | 1.7 | 665.0 |
| qjs_cluster_1w_GET_10c__api_users | qjs_cluster | 1 | 10 | /api/users | GET | 1134.9 | 8.8 | 1.5 | 756.6 |

## Key Metrics

### Throughput (Requests per Second)
```
node_GET_100c__api_users_1              :    695.5 req/s
node_GET_100c__api_users                :    700.1 req/s
node_GET_10c__api_users_1               :    604.3 req/s
node_GET_10c__api_users                 :    613.5 req/s
node_GET_1c__api_users_1                :    450.7 req/s
node_GET_1c__api_users                  :    449.2 req/s
node_GET_200c__api_users_1              :    688.6 req/s
node_GET_200c__api_users                :    683.5 req/s
node_GET_50c__api_users_1               :    694.7 req/s
node_GET_50c__api_users                 :    708.7 req/s
```

### Memory Efficiency (Requests per Second per MB)
```
node_GET_100c__api_users_1              :      7.4 req/s/MB
node_GET_100c__api_users                :      7.5 req/s/MB
node_GET_10c__api_users_1               :      6.6 req/s/MB
node_GET_10c__api_users                 :      6.7 req/s/MB
node_GET_1c__api_users_1                :      4.9 req/s/MB
node_GET_1c__api_users                  :      4.8 req/s/MB
node_GET_200c__api_users_1              :      7.1 req/s/MB
node_GET_200c__api_users                :      7.3 req/s/MB
node_GET_50c__api_users_1               :      7.4 req/s/MB
node_GET_50c__api_users                 :      7.7 req/s/MB
```

### Best Latency
```
node_GET_100c__api_users_1              :    143.8 ms
node_GET_100c__api_users                :    142.8 ms
node_GET_10c__api_users_1               :     16.5 ms
node_GET_10c__api_users                 :     16.3 ms
node_GET_1c__api_users_1                :      2.2 ms
node_GET_1c__api_users                  :      2.2 ms
node_GET_200c__api_users_1              :    290.5 ms
node_GET_200c__api_users                :    292.6 ms
node_GET_50c__api_users_1               :     72.0 ms
node_GET_50c__api_users                 :     70.6 ms
```

## Raw Data Files
- `results_detailed.csv`: Complete test results
- `results_summary.csv`: Aggregated statistics
- `*_ab.txt`: Raw ApacheBench output
- `*_server.log`: Server logs during tests

