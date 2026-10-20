# C4 有界未插樁 ABBA

Bounded ABBA: 5 attempts/pass; two passes per variant/group => 10 valid if no failure. Nearest-rank ceil(n*p)-1. NOT the >=30/group full Gate. Real pointer -> durable ACK -> committed DOM assertion + 2 RAF; DB receipt checked afterward. All slow values retained.

|世界／畫面／倍率|版本|有效|p50 ms|p95 ms|max ms|>1s|比例|
|---|---|---:|---:|---:|---:|---:|---:|
|96h／桌面／10X|after|10|561.5|1142.0|1142.0|1|10.0%|
|96h／桌面／10X|before|10|614.3|1599.5|1599.5|2|20.0%|
|168h／桌面／50X|after|10|971.0|1544.8|1544.8|5|50.0%|
|168h／桌面／50X|before|10|1094.3|4827.5|4827.5|7|70.0%|
|168h／手機／10X|after|10|786.2|1309.6|1309.6|1|10.0%|
|168h／手機／10X|before|10|1193.9|2349.5|2349.5|8|80.0%|
|168h／手機／50X|after|10|796.2|1143.1|1143.1|2|20.0%|
|168h／手機／50X|before|10|885.1|1788.2|1788.2|2|20.0%|
