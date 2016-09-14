---
layout: post
title: Synchronizing Clocks In a Cassandra Cluster
date: 2015-11-17
published: false
tags:
- cassandra
- ntp
meta: {}
author: Brice Dutheil
---

Sources from Viliam Holub:

 * [part1](https://blog.logentries.com/2014/03/synchronizing-clocks-in-a-cassandra-cluster-pt-1-the-problem/)
 * [Part2](https://blog.logentries.com/2014/03/synchronizing-clocks-in-a-cassandra-cluster-pt-2-solutions/)


## The Problem

Cassandra is a highly-distributable NoSQL database with tunable consistency. What makes it highly distributable makes it also, in part, vulnerable: the whole deployment must run on synchronized clocks.

It’s quite surprising that, given how crucial this is, it is not covered sufficiently in literature. And, if it is, it simply refers to **installation of a NTP daemon on each node which – if followed blindly – leads to really bad consequences**. You will find blog posts by users who got burned by clock drifting.

In the first installment of this two part series, I’ll cover how important clocks are and how bad clocks can be in virtualized systems (like Amazon EC2) today. In the next installment, coming out next week, I’ll go over some disadvantages of off-the-shelf NTP installations, and how to overcome them.

### About clocks in Cassandra clusters

**Cassandra serializes write operations by time stamps you send with a query**. Time stamps solve an important serialization problem with inherently loosely coupled nodes in large clusters. At the same time however, time stamp are its Achilles’ heel. If system clocks runs off each other, so does time stamps of write operations and you are about to experience inexplicable data inconsistencies. It is crucial for Cassandra to have clocks right.

Boot-time system clock synchronization is not enough unfortunately. No clock is the same and you will eventually see clock drifting, i.e. growing difference among clocks in the system. You have to maintain clock synchronization continually.

**It is a common misconception that clocks on virtual machines are somewhat resistant against clock drifting**. In fact, virtual instances are especially prone to, even in a dramatic way, if the system is under heavy load. On Amazon EC2, you can easily observe drift about 50ms per day on unloaded instance and seconds per day on a loaded instance.

How much clocks need to be synchronized? It depends on your type of work load. If you run read-only or append-only queries, you are probably fine with modestly synchronization. However if you run concurrent read-update queries it’s starting to be serious. And if you do so because of API calls or concurrent job processing, it’s critical down to milliseconds.

Unfortunately, there is great, off-the-shelf ready solution. Why unfortunately?

### Network Time Protocol

[Network Time Protocol](https://en.wikipedia.org/wiki/Network_Time_Protocol) (NTP) gets the time from external time source in the network and propagates it further down the network. NTP uses hierarchical tree-like topology, where each layer is referred to as _“clock strata”_, starting with _Stratum 0_ as the authoritative time source, and continuing with _Strata 1_, _2_, etc. Nodes which synchronizes clocks with nodes on Stratum n become nodes on Stratun n+1. NTP daemon sends time queries periodically to specified servers, adjusts the value to network latency associated with the message transmission, and re-adjusts the local clock to the calculated time. Running NTP daemon will help to avoid clock drifting especially on loaded machines.

In order to make NTP work you need to specify a set of servers where the current time will be pulled from. NTP servers may be provided by your network supplier, or you can use publicly available NTP servers. The best list of available public NTP servers is [NTP pool project](http://www.pool.ntp.org/) where you can also find best options for you geographical region. It is a good thing to use this pool. You should not use NTP servers without consent of the provider.



### How to install NTP daemon

Installing NTP daemon is as simple as:

```sh
aptitude install ntpd
```

and it works immediately. That’s because it is pre-configured to use a standard pool of NTP servers. If you look at `/etc/ntp.conf` you will see servers defined with the server parameter, for example:

```
server 0.debian.pool.ntp.org iburst
server 1.debian.pool.ntp.org iburst
server 2.debian.pool.ntp.org iburst
server 3.debian.pool.ntp.org iburst
```

This is default for Debian systems, you may see a slightly different list in your distribution. The `iburst` parameter is there for optimization. If you want to check how NTP daemon works, run the following command: `ntpq -p`. You will get a list similar to this one:

```
remote           refid      st t when poll reach   delay   offset  jitter
==============================================================================
*dns1.dns.imagin 213.130.44.252   3 u   17   64    7    1.979    0.035   0.235
-eu-m01.nthweb.c 193.1.219.116    2 u   19   64    7    1.064    9.067   0.094
+tshirt.heanet.i .PPS.            1 u   15   64    7    3.276   -0.193   0.066
+ns0.fredprod.co 193.190.230.65   2 u   15   64    7    0.818   -0.699   8.112
```

It shows you the list of servers it synchronizes to, its reference, stratum, synchronization periods, response delay, offset from the current time and jitter.

NTP uses optimizing algorithm which selects the best source of current clock as well as a working set of servers it takes into account. Node marked with `*` is the current time source. Nodes marked with `+` are used in the final set. Nodes marked with `-` are discarded by the algorithm.

You can restart NTP daemon with

```sh
service ntpd restart
```

and watch grabbing a different set of servers, selecting the best source and gradually increasing the period when servers are contacted when the clock gets stabilized.
Works like a charm.

### Why not to just install NTP daemon on each node

If NTP works so great out of the box, why not simply install it on all boxes? In fact, this is exactly the advice you commonly get for cluster setup.

With respect to Cassandra, it’s the **relative difference among clocks that matters**, not their absolute accuracy. By default NTP will sync against a set of random NTP servers on the Internet which will result in synchronization of absolute clocks. Therefore the relative difference of clocks in the C* cluster will depend on how clocks are synchronized to absolute values from several randomly chosen public servers.

Look at the (real) example output from the ntpq command, the offset column. The difference among clocks is about 0.1ms, 0.5ms, but there is also an outlier with 9ms difference. Synchronization to the millisecond is a reasonable requirement, which requires one to synchronize absolute clocks to 0.5ms after/before boundary.

How precise, in absolute values, are public NTP servers? We ran a quick check of 560 randomly chosen public NTP servers from the public pool. The statistics are:

* 11% are below 0.5ms drift
* 15% are below 1ms drift
* 62% are below 10ms drift
* 11% are below 100ms drift

There are also outliers, with one being off by multiple hours.

Assuming: (1) our checks are representative, (2) each NTP daemon picks up 4 random NTP servers, and (3) synchronizing to the second best option (this is optimistic) these are the probabilities of our cluster clocks being off:

```
Nodes       5         10        25        100
95%          2.489     5.180     9.349    19.723
50%          7.122    10.892    18.872    44.394
25%         10.917    16.969    30.855    54.197
10%         18.584    30.291    45.311    66.942
```

How to read it: assume a cluster of 25 nodes, then with the probability of 50% there will be two nodes with clock difference of more than 18.8ms.

**The results may be surprising – even in a small cluster of 10 nodes they will be off by more than 10.9ms half of the time, and with a probability of 10% it will be off by more than 30ms**.




## Solutions

Previous section covered how important clocks are and how bad clocks can be in virtualized systems (like Amazon EC2) today. In today’s installment, I’m going to cover some disadvantages of off-the-shelf NTP installations, and how to overcome them.

#### Configuring NTP daemons

As stated in my last post, it’s the relative drift among clocks that matters most. Syncing independently to public sources will lead to sub-optimal results. Let’s have a look at the other options we have and how well they work. Desirable properties are:

* **Good relative synchronization**; Required for synchronization in the cluster
* **Good absolute synchronization**; Desirable or required if you communicate with external services or provide an API for customers
* **Reliability and high availability**; Clock synchronization should survive instance failure or certain network outages
* **Easy to maintain**; It should be easy to add/remove nodes from the cluster without a need to change configuration on all nodes
* **Netiquette**; While NTP itself is very modest in network bandwidth use, that’s not the case for public NTP servers. You should reduce their load if feasible

### Configure the whole cluster as a mesh

NTP uses tree-like topology, but allows you to connect a pool of peers for better synchronization on the same strand level. This is ideal for synchronizing clocks relative to each other. Peers are defined similarly to servers in `/etc/ntp.conf`; just use the `peer` keyword instead of `server` (you may combine servers and peers, but more about it later):

```
peer c0 iburst
peer c1 iburst
peer c2 iburst
restrict 10.0.0.0 mask 255.0.0.0 # XXX Don't copy this blindly
```

We define that nodes `c0-c2` are peers on the same layer and will be synchronized with each other. The restrict statement enables peering for a local network, assuming your instances are protected by a firewall for external access, but enabled within the cluster. NTP communicates via `UDP` on port `123`. Restart NTP daemon:

```sh
service ntp restart
```

And check how it looks like in `ntpq -p`:

```
remote           refid      st t when poll reach   delay   offset  jitter
==============================================================================
*c0              11.2.21.77       2 u   29 1024  377    1.318   -0.536   1.767
+c1              11.26.233.10     3 u  133 1024  377    1.587    0.401   1.837
-c2              11.129.56.278    4 u  662 1024  377    0.869    0.010   1.641
```

This setting is not ideal, however. Each node acts independently and you have no control over which nodes will be synchronized to. You may well end up in a situation of smaller pools inside the cluster synchronized with each other, but diverging globally.

A relatively new [orphan mode](http://support.ntp.org/bin/view/Support/OrphanMode) solves this problem by electing a leader each node synchronizes to. Add this statement in `/etc/ntp.conf` **on all nodes**:

```
tos orphan 7
```

to enable `orphan` mode. The mode is enabled when no server stratum less than _7_ is reachable.

This setup will eventually **synchronize clocks perfectly** to each other. You are in danger of **clock run-away** however, and thus absolute time synchronization is suboptimal. NTP daemon handles missing nodes gracefully and therefore high availability is satisfied.

Maintaining the list of peer servers in NTP configuration and updating it with every change in the cluster is not ideal from a maintenance perspective. Orphan mode allows you to use broadcast or manycast discovery. Broadcast may not be available in a virtualized network and, if it is, don’t forget to enable authentication. Manycast works at the expense of maintaining a manycast server and reducing resilience against node failure.

* \+ relative clocks (stable in orphan mode)
* – absolute clocks (risk of run-away)
* \+ high reliability (- for manycast server)
* – maintenance (+ in auto-discovery orphan mode)
* \+ low network load


### Use external NTP server and configure the whole cluster as a pool

Given clock run-away as the main disadvantage in the previous option, what about enabling synchronization with external servers and improving relative clocks by setting up a pool across nodes?

The configuration in `/etc/ntp.conf` would look like this:

```
server 0.debian.pool.ntp.org iburst # External servers
server 1.debian.pool.ntp.org iburst # http://www.pool.ntp.org/
server 2.debian.pool.ntp.org iburst
server 3.debian.pool.ntp.org iburst
peer c0 iburst # Peers in the cluster
peer c1 iburst
peer c2 iburst
restrict 10.0.0.0 mask 255.0.0.0 # XXX don't copy this blindly
```

Synchronizing Clocks In a Cassandra ClusterAs nice as it may look like, this actually **does not work as well as the previous option**. You will end up with synchronized absolute clocks but relative clocks will not be affected. That’s because the NTP algorithm will detect an external time source as more reliable than those in the pool and will not take them as authoritative.

* – relative clocks
* ? absolute clocks (similar as if all nodes are synchronized independently)
* \+ high availability
* – maintenance
* – high network load


### Configure centralized NTP daemon

The next option is to dedicate one NTP server (a core server, possibly running on a separate instance). This server is synchronized with external servers while the rest of the cluster will synchronize with this one.

Apart from enabling the firewall you don’t need any special configuration on the core server. On the client side you will need to specify the core instance name (let it be `0.ntp`). The `/etc/ntp.conf` file must contain this line:

```
server 0.ntp iburst
```

All instances in the cluster will synchronize with just one core server and therefore one clock. This setup will achieve good relative and absolute clock synchronization. Given that there is only one core server, there is no higher availability in case of instance failure. Using a separate static instance gives you flexibility during cluster scale and repairs.

You can additionally set up the orphan mode among nodes in the cluster to keep relative clocks synchronized in case of core server failure.

* \+ relative clocks
* \+ absolute clocks
* – high availability (improved in orphan mode)
* – maintenance (in case the instance is part of the scalable cluster)
* \+ low network load


### Configure dedicated NTP pool

This option is similar to a dedicated NTP daemon, but this time you use a pool of NTP servers (core servers). Consider three instances `0.ntp`, `1.ntp`, `2.ntp`, each run in a different availability zone with an NTP daemon configured to synchronize with external servers as well as each other in a pool.

The configuration on one of the core `servers0.ntp` would contain:

```
server 0.debian.pool.ntp.org iburst # External servers
server 1.debian.pool.ntp.org iburst
server 2.debian.pool.ntp.org iburst
server 3.debian.pool.ntp.org iburst
peer 0.ntp iburst # Our NTP pool
peer 1.ntp iburst
restrict 10.0.0.0 mask 255.0.0.0 # XXX don't copy this blindly
```

Clients are configured to use all core servers, i.e. `0.ntp-2.ntp`. For example, the `/etc/ntp.conf` file contains these lines:

```
server 0.ntp iburst
server 1.ntp iburst
server 2.ntp iburst
```

By deploying a pool of core servers we achieve high availability for the server side (partial network outage) as well as for the client side (instance failure). It also eases maintenance of the cluster since the pool is independent from the scalable cluster. The disadvantage lays in running additional instances. You can avoid running additional instances by using instances already available outside the scalable cluster (i.e. static instances) such as a database or mail server.

Notice that core servers experience some clock differences as if each node is separately synchronized with external servers. Setting them as peers will help in network outages, but not so much in synchronizing clocks relatively to each other. Since you have no control over which core server the client will select as authoritative, this results in worsening relative clock synchronization between clients – although significantly lower than if all clients were synchronized externally.

One solution is to use the `prefer` modifier to alter NTP’s selection algorithm. Assume we would change the configuration on all clients:

```
server 0.ntp iburst prefer
server 1.ntp iburst
server 2.ntp iburst
```

Then all clients will synchronize to 0.ntp node and switch on another one only if `0.ntp` is down. Another option is to explicitly set increasing stratum numbers for all core servers assuming that clients will gravitate towards servers with lower strata.  That’s more of a hack, though.

* \+ relative clocks
* \+ absolute clocks
* \+ high availability
* \+ maintenance
* \+ low network load
* – requires static instances

## Summary

If you are running a computational cluster you should consider running your own NTP server. Letting all instances synchronize their clocks independently leads to poor relative clock synchronization. It is also not considered good netiquette since you unnecessarily increase load on public NTP servers.

For a bigger, scalable cluster, the **best option** is to run your own NTP server pool externally synchronized. It gives you perfect relative and absolute clock synchronization, high availability, and easy maintenance.

Our own deployment synchronizes clocks of all nodes to a millisecond precision.


### Post scriptum : On Virtual machines

If cassandra nodes are running on virtual machines, there may be a rule that makes the machines synchronize on the hypervisor before the NTP daemon is run. That may be an issue because if there's too much difference then NTP daemon won't fix the clock. So make sure the hypervisor machine is also synchronizing on the right NTP servers.




### PS 2 systemd unit :

```
[Unit]
Description=Network Time Service
After=syslog.target ntpdate.service sntp.service network-online.target

[Service]
Type=forking
EnvironmentFile=-/etc/sysconfig/ntpd
ExecStart=/usr/sbin/ntpd -u ntp:ntp $OPTIONS
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
