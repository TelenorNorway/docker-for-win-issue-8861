# docker-for-win-issue-8861
Repo for PoC code relating to https://github.com/docker/for-win/issues/8861 (which in turn seems to originate from https://github.com/moby/vpnkit/issues/587)

# Update 2022-12-13
* Added link to suspected root-issue; https://github.com/moby/vpnkit/issues/587
* Updated k6 to v0.41.0 (grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03)
* Update to the httpd-version used (httpd:2.4.54-alpine3.17@sha256:de0463e48280a381111c9c6750f1c88729aa06a99f8d77b0e19ea6deeea9a5a9)
* Adjusted httpd-config to cater to the increased volume of calls needed to reproduce the issue
* As of Docker Desktop v4.15.0, the issue is further reduced (as compared to v4.13.1). Increasing various parameters may yield the same error-message, replacing the command in "Run tests, #2" with e.g.:

~~~
FOR /L %G IN (1,1,30) DO docker run --rm --env CASE=4 --env MULTIPLIER=2800 --env TARGET_HOST=http://host.docker.internal:9080/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js
~~~

# Update 2022-11-11
* As of Docker Desktop v4.13.1, the issue is greatly reduced. The below cases do no longer reliably reproduce the issue. Increasing various parameters sometimes yield the same error-message, replacing the command in "Run tests, #2" with e.g.:

~~~
FOR /L %G IN (1,1,20) DO docker run --rm --env CASE=4 --env MULTIPLIER=2500 --env TARGET_HOST=http://host.docker.internal:9080/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js
~~~

# Pre-req:
- Docker (Desktop for windows at least, this testcase has not been verified on other OS/combos)

# Pre-req (optional):
- K6 installed locally for some tests (v0.41.0)
- Apache httpd installed locally for some tests (v2.4.54)

# Apache config:
I have made the following changes to the default apache config:
- Disabled logging to console
- Tuned the mpm_event_module to avoid hitting Apache resource limits for some tests (to rule out this as the root cause)

# K6 test cases and parameters

The testcase.js uses the following environment variables (as set with the Docker `--env` flag):
- CASE
- MULTIPLIER
- TARGET_HOST

| CASE | Description                                                                                                                                                | What MULTIPLIER controls                                                                                  |
|------|------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| 1    | My original testcase. Playing back 30 minutes of per-minute traffic using constant-arrival-rate executor, with per-minute variable load and VU-allocation. | Increases the baseline with the MULTIPLIER-factor. 1 is the original rate and 2 is twice that and so on   |
| 2    | Same as 1, but using ramping-arrival-rate with fixed VU-allocation and per-minute variable load.                                                           | Same as 1                                                                                                 |                             
| 3    | Runs the maximum number of calls for 30 minutes with VU fixed (as set my MULTIPLIER). This was to model the time-domain of case 1.                         | Number of VU's running in parallel                                                                        |
| 4    | Runs the same no. of iterations as case 1 as fast as possible, with the given VU-allocation (as set my MULTIPLIER)                                         | Number of VU's to distribute the fixed set of iterations across                                           |

TARGET_HOST always controls what URL to hit.

# Steps:
Commands intended to run from repo root directory. 
Between tests run `wsl --shudown` wait 8 seconds for good measures and restart Docker, in order to reset the environment.

## Start Apache
Windows (run this on a command-prompt on its own, or as a daemon):
~~~
docker run -it --rm --name my-apache -h my-apache -p 9080:80 -p 9443:443 -v "%cd%/src/main/apache-httpd/web":/usr/local/apache2/htdocs/ -v "%cd%/src/main/apache-httpd/conf/":/usr/local/apache2/conf/ httpd:2.4.54-alpine3.17@sha256:de0463e48280a381111c9c6750f1c88729aa06a99f8d77b0e19ea6deeea9a5a9
~~~

## Run tests
For the more extensive description about the various tests and observations, please see the acompaning Medium article at https://medium.com/@olebhansen/what-i-learned-from-a-wild-goose-chase-with-k6-and-docker-2a7dcfa00265
Note: when pushing beyond a multiplier of 1000 running from the host, I observe `WARN[0004] Request Failed error="Get \"http://localhost:9080/\": dial tcp 127.0.0.1:9080: connectex: No connection could be made because the target machine actively refused it."`. This is not observed within Docker. All tests have been adjusted for this, to keep parameters identical.

Windows (run this on a different command-prompt than the Apache http-server):
### 1
Running a single round of testing from K6-in-Docker via `host.docker.internal` to Apache-in-Docker works
~~~
docker run --rm --env CASE=4 --env MULTIPLIER=1000 --env TARGET_HOST=http://host.docker.internal:9080/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js
~~~
### 2
Running testing from K6-in-Docker via `host.docker.internal` to Apache-in-Docker (multiple times in a row will trigger issue - issue usually happens with 4-5 consecutive executions.)
~~~
FOR /L %G IN (1,1,6) DO docker run --rm --env CASE=4 --env MULTIPLIER=1000 --env TARGET_HOST=http://host.docker.internal:9080/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js 
~~~
### 3
Running testing from K6-in-Docker via `host.docker.internal` to Apache-in-Docker (with spacing in between will *NOT* trigger issue)
~~~
FOR /L %G IN (1,1,6) DO docker run --rm --env CASE=4 --env MULTIPLIER=1000 --env TARGET_HOST=http://host.docker.internal:9080/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js && timeout 120
~~~
### 4
Running testing from K6-in-Docker to Apache-in-Docker on Docker-internal networking (will *NOT* trigger issue)
~~~
FOR /L %G IN (1,1,6) DO docker run --rm --network container:my-apache --env CASE=4 --env MULTIPLIER=1000 --env TARGET_HOST=http://my-apache/ -i grafana/k6:0.41.0@sha256:f34ad059aebe2bab8951e7aeed946d4445db48b99cf9c79bdc0ab889e5a9fd03 run - <src\main\k6\testcase.js
~~~



# Optional
## HTTPS
The issue seems accelerated by the use of TLS. If testing this is desirable:
- Activate TLS-features in httpd.conf
  - ( 94) `LoadModule socache_shmcb_module modules/mod_socache_shmcb.so`
  - (161) `LoadModule ssl_module modules/mod_ssl.so`
  - (542) `Include conf/extra/httpd-ssl.conf`
- Create certificates
  - e.g. (I ran this though WSL for the openssl implementation): `openssl req -x509 -newkey rsa:4096 -keyout src/main/apache-httpd/conf/key.pem -out src/main/apache-httpd/conf/cert.pem -sha256 -days 365 -subj "/C=US/ST=Oregon/L=Portland/O=Demo Company/OU=Org/CN=localhost"`
- If needed, update conf/extras/httpd-ssl.conf (to reflect certificate location and logging preferences if the current edits is not sufficient)

Running testing from K6-on-host to Apache-in-Docker (will *NOT* trigger issue)
~~~
FOR /L %G IN (1,1,6) DO k6 --env CASE=4 --env MULTIPLIER=1000 --env TARGET_HOST=http://localhost:9080/ run src\main\k6\testcase.js
~~~

## Local Apache httpd
Install Apache httpd locally and point to it using TARGET_HOST accordingly. Not yet tested/documented though
