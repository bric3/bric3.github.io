---
layout: post
title: Killing zookeeper instances on a local ensemble
date: 2015-11-17
published: false
tags:
- zookeeper
- cluster
- ensemble
meta: {}
author: Brice Dutheil
---

## Setup a 5 peer cluster

### Configuration

```bash
mkdir -p ~/zktests/local/cluster
cd ~/zktests/local/cluster
wget 
```


Create a configuration file that will serve as a template, notice the text to be replaced `{{peer}}`
and `{{dataDir}}`, save it to `zoo.template.cfg` :

```properties
server.1=localhost:28881:38881
server.2=localhost:28882:38882
server.3=localhost:28883:38883
server.4=localhost:28884:38884
server.5=localhost:28885:38885
syncLimit=5
initLimit=10
tickTime=2000
quorumListenOnAllIPs=true
clientPort=2181{{peer}}
autopurge.purgeInterval=24
dataDir={{dataDir}}
autopurge.snapRetainCount=10
```

Then we want those placeholders to be replaced according to the zookeeper peer. Then we need to create the data
directory structure.The following 3 shell commands will :

* create a ` zoo.$i.cfg` from the `zoo.template.cfg` in the current directory
* create a folder `$i` where the data will be put (property `dataDir`)
* create a file `myid` in each of those data folder with the identifier of the zookeeper peer (i.e. the text `$i`)

```bash
for i in {1..5}; do echo zk-$i; echo "zk-peer-$i config file"; cat zoo.template.cfg | sed -e "s|{{dataDir}}|$(pwd)/$i|g" -e "s|{{peer}}|$i|g" > zoo.$i.cfg; done
for i in {1..5}; do mkdir $i; done
for i in {1..5}; do echo $i > $i/myid; done
```

### Run the ensemble

Once the configuration files and the proper data structure is done it is possible to run the ensemble.
The following bash command will start the 5 zookeeper instances from the current directory.

```bash
for i in {1..5}; do env ZOO_LOG_DIR=`pwd`/$i `pwd`/zookeeper-3.4.6/bin/zkServer.sh start `pwd`/zoo.$i.cfg; done
jps -v
```

To check that all instances are running correctly, we will ask the zookeeper instance by sending a
**4 letter word** on the _client port_. They are several words, the one we want to use here is `stat`


```bash
for i in {1..5}; do echo "zk peer $i"; echo stat | nc localhost 2181$i; done
```


### Stopping the whole ensemble

In order to shutdown properly the ensemble, we should use the `stop` command. The following bash script will
invoke the `stop` command on each instances.

```bash
for i in {1..5}; do env ZOO_LOG_DIR=`pwd`/$i `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.$i.cfg; done
```


## Killing leader instances

On a stable and working ensemble, i.e. the 5 instances are up and running, we'd like to play a bit with
instance loss.

In a separate terminal window watch the stats of the zk ensemble :

```bash
watch --difference --color 'for i in {1..5}; do printf "\nzk peer $i\n"; echo stat | nc localhost 2181$i; done'
```

### With the stop script

Find the leader (see `mode : leader`), e.g. if peer `2` is the leader, we should see something like :

```
zk peer 2
Zookeeper version: 3.4.6-1569965, built on 02/20/2014 09:09 GMT
Clients:
 /0:0:0:0:0:0:0:1:64572[0](queued=0,recved=1,sent=0)

Latency min/avg/max: 0/0/0
Received: 202
Sent: 201
Connections: 1
Outstanding: 0
Zxid: 0x700000000
Mode: leader
Node count: 4
```


```bash
env ZOO_LOG_DIR=`pwd`/2 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.2.cfg
```

Then watch the zookeeper ensemble become unavailable for a moment until the new leader is elected,
it shouldn't take much more than a second. As it is a 5 server ensemble, a second instance down can be
tolerated. So let's stop it. This time let's suppose it is the peer `5`.


```bash
env ZOO_LOG_DIR=`pwd`/5 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.5.cfg
```

And the watching terminal window will show again a short period of unvailability until a new leader is elected,
again it should be much more that a second.




### With a `kill`

`kill` sends by default the `TERM` (`15`) signal, which allows a graceful process termination.

Ensure all peers are up and running, if peer `2` and `5` were down. Start them again :

```bash
env ZOO_LOG_DIR=`pwd`/2 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.2.cfg
env ZOO_LOG_DIR=`pwd`/5 `pwd`/zookeeper-3.4.6/bin/zkServer.sh stop `pwd`/zoo.5.cfg
```

Following the same method as before, find the leader of the ensemble, then find the pid of the leader.


Supposing the leader is the peer `1`, then the pid is identifiable using the log dir, other tricks are available.
Let's kill it. By default the pid file is created in the data directory, the data directory that we configured
with the id of the peer ; this can be overridden by changing the `ZOOPIDFILE` environment variable.

```bash
kill $(< 1/zookeeper_server.pid)
```

Same as before one can watch a short unavailibity period until a new zookeeper instance is elected the leader of
the ensemble.


### With a `kill -9`

Same dance find the leader then the pid, but this time let's kill it with the `KILL` (`9`) which just kills
the process without allowing a process to terminate gracefully. Suppose the leader is now the peer `2`.

```bash
kill -KILL $(< 2/zookeeper_server.pid)
```

This time again the zookeeper ensemble handles correctly the lost of another peer.


## Wrap Up

We see that a zookeeper ensemble can recover from a peer loss quite fast, but the loss of leaders introduces a
window of unavailibity. This scenarios were run locally that means that the ensemble uses the _loopback_
network interface; reproducing those scenarios on different machines may prove to be better to introduce
network latencies (disclaimer zookeeper doesn't like latencies especially if it happens on a single instance).


