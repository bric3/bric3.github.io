---
layout: post
title: When Java's WatchService is not enough in your container
date: 2018-06-18
published: false
tags:
- Java
- Linux
- docker
- inotify
author: Brice Dutheil
---

## Boring code that should be written once and run everywhere

Suppose the application you're working on needs to monitor changes to a 
file and rely on Java's `WatchService` introduced in Java 7. Developing 
it and testing it locally works, in unit tests as you want to control 
the content of the file the test rely on a `TemporaryFolder` Junit rule.
Everything is green to go live.

This file is `/etc/hosts`.

However when the application is live in production, nothing happen when
the file is modified. How is it possible ?



The code to reproduce is quite boring:


```java
import java.lang.Exception;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.FileSystems;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;

public class WatchFile {
    public static void main(String... args) throws Exception {
        String filepath = args[0];
        Path path = FileSystems.getDefault()
                               .getPath(filepath);
        System.out.printf("Watching : %s%n", path);
        try (WatchService watchService = FileSystems.getDefault().newWatchService()) {
            WatchKey watchKey = (Files.isDirectory(path) ? path : path.getParent())
                                    .register(watchService, 
                                              StandardWatchEventKinds.ENTRY_MODIFY);
            while (true) {
                WatchKey wk = watchService.take();
                for (WatchEvent<?> event : wk.pollEvents()) {
                    Path changed = (Path) event.context();
                    System.out.printf("Modified : %s%n", changed);
                    if (changed.endsWith(path.getFileName().toString())) {
                        System.out.printf("  -> : %s%n", path);
                    }
                }
            }
        }
    }
}
```

This simple code expects an argument that is a path to a directory or a file,
for example when run locally:

```
############ terminal A ##############|############ terminal B ###########
> java WatchFile /etc/hosts           | 
Watching : /etc/hosts                 | # wait for WatchFile to be started
                                      | > touch /etc/hosts
Modified : hosts                      |
  -> : /etc/hosts                     |
```

So what may happen under the hood, the first thing to notice is that
`WatchService` abstracts (or not) what the underlying OS provides to be 
notified when something changed in the file system.

For example the JDK on MacOs the following statement 
`FileSystems.getDefault().newWatchService()` will return a _KISS_ [polling
watcher](http://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/share/classes/sun/nio/fs/PollingWatchService.java).


So we are running in a container, and on Linux, so the following should 
just work, write once run everywhere, that was the promise of Java right:

```
############ terminal A ##############|############ terminal B ###########
> docker container run -it \          | > docker container exec -it \
  adoptopenjdk/openjdk8:latest \      |   612f6247d0b7 \
  /bin/bash                           |   /bin/bash
root@612f6247d0b7:/# \                | # wait for WatchFile to be started
  java WatchFile /etc/hosts           | root@612f6247d0b7:/# \
Watching : /etc/hosts                 |   touch /etc/hosts
                                      | 
# nothing happens                     | 
```

So no it doesn't work everywhere, it works fine on my local machines 
wether it is Linux or OSX, but not in a container ?!


## Linux Watch Service uses `inotify`

Let's dig a little bit in the `WatchService` implementation on Linux.

On Linux the implementation [`sun.nio.fs.LinuxWatchService`](http://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java)
makes use of `inotify` which is a proven technology to watch Linux 
filesystems.

```java
/**
 * Linux implementation of WatchService based on inotify.
 *
 * In summary a background thread polls inotify plus a socket used for the wakeup
 * mechanism. Requests to add or remove a watch, or close the watch service,
 * cause the thread to wakeup and process the request. Events are processed
 * by the thread which causes it to signal/queue the corresponding watch keys.
 */
```

In shorts `inotify` allows to register a _watch_ and receive notifications 
on file-system change events. So let's try with the system tools in our 
container.

First install `inotify-tools` in the running container.

```bash
root@612f6247d0b7:/# apt-get update
...
root@612f6247d0b7:/# apt-get install -y inotify-tools
```

Then let's add a watch on `/etc/hosts` in shell session _A_, once 
_established_ modify the watched file in session B.

```
############ terminal A ##############|############ terminal B ###########
root@612f6247d0b7:/# \                | 
  inotifywait -m /etc/hosts           | 
Setting up watches.                   | 
Watches established.                  | 
                                      | root@612f6247d0b7:/# \
                                      |   touch /etc/hosts
/etc/hosts OPEN                       | 
/etc/hosts ATTRIB                     | 
/etc/hosts CLOSE_WRITE,CLOSE          | 
```

In console A, the expected events are observed, so inotify appears to be 
working as expected.

But remember that Java `WatchService` API only allow to register a directory

> ```java
> /**
>  * A watch service that <em>watches</em> registered objects for changes and
>  * events. For example a file manager may use a watch service to monitor a
>  * directory for changes so that it can update its display of the list of files
>  * when files are created or deleted.
> ```

So let's try again with a watch on the `/etc` folder instead with the 
same scenario, in shell session A set-up a watch, then once ready modify 
the actual file:

```
############ terminal A ##############|############ terminal B ###########
root@612f6247d0b7:/# \                | 
  inotifywait -m /etc                 | 
Setting up watches.                   | 
Watches established.                  | 
                                      | root@612f6247d0b7:/# \
                                      |   touch /etc/hosts
/etc/ OPEN ld.so.cache                | 
/etc/ CLOSE_NOWRITE,CLOSE ld.so.cache | 
```

In console A, different set of events are observed ; no ATTRIB or MODIFY 
events and interestingly the events are about a `ld.so.cache`.

So not quite what the Linux implementation relying on `inotify` expects to 
notice file modifications if you inspects the [source code (line 382)](http://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java#l382).

That's weird, let's trying the same scenario on a different file in `/etc`,
that is a newly created file named `somefile`

```
############ terminal A ##############|############ terminal B ###########
root@612f6247d0b7:/# \                | 
  inotifywait -m /etc                 | 
Setting up watches.                   | 
Watches established.                  | 
                                      | root@612f6247d0b7:/# \
                                      |   touch /etc/somefile
/etc/ OPEN ld.so.cache                | 
/etc/ CLOSE_NOWRITE,CLOSE ld.so.cache | 
/etc/ CREATE somefile
/etc/ OPEN somefile
/etc/ ATTRIB somefile
/etc/ CLOSE_WRITE,CLOSE somefile
```

OK we got the wanted events, if we run our Java `WatchFile` program it is 
notified by the file change.

```
############ terminal A ##############|############ terminal B ###########
root@612f6247d0b7:/# \                |
  java WatchFile /etc/somefile        | 
Watching : /etc/somefile              | # wait for WatchFile to be started
                                      | root@612f6247d0b7:/# \
                                      |   touch /etc/somefile
Modified : somefile                   |
  -> : /etc/somefile                  |
```

So there is something with `/etc/hosts` in particular that prevents 
`inotify` to see the change if the watch is set up on  the directory.

## The clue

Interestingly I remembered this paragraph in the `WatchService` javadoc :

> ```java
>  * <p> If a watched file is not located on a local storage device then it is
>  * implementation specific if changes to the file can be detected. In particular,
>  * it is not required that changes to files carried out on remote systems be
>  * detected.
> ```

So since this app is running in a container, let's have a look at mounts

```bash
root@612f6247d0b7:/# findmnt
TARGET                          SOURCE                                                                               FSTYPE  OPTIONS
/                               overlay                                                                              overlay rw,relatime,lowerdir=/var/lib/docker/overlay2/l/TZPBTDTJWKHEY
|-/proc                         proc                                                                                 proc    rw,nosuid,nodev,noexec,relatime
| |-/proc/bus                   proc[/bus]                                                                           proc    ro,relatime
| |-/proc/fs                    proc[/fs]                                                                            proc    ro,relatime
| |-/proc/irq                   proc[/irq]                                                                           proc    ro,relatime
| |-/proc/sys                   proc[/sys]                                                                           proc    ro,relatime
| |-/proc/sysrq-trigger         proc[/sysrq-trigger]                                                                 proc    ro,relatime
| |-/proc/acpi                  tmpfs                                                                                tmpfs   ro,relatime
| |-/proc/kcore                 tmpfs[/null]                                                                         tmpfs   rw,nosuid,size=65536k,mode=755
| |-/proc/keys                  tmpfs[/null]                                                                         tmpfs   rw,nosuid,size=65536k,mode=755
| |-/proc/timer_list            tmpfs[/null]                                                                         tmpfs   rw,nosuid,size=65536k,mode=755
| `-/proc/sched_debug           tmpfs[/null]                                                                         tmpfs   rw,nosuid,size=65536k,mode=755
|-/dev                          tmpfs                                                                                tmpfs   rw,nosuid,size=65536k,mode=755
| |-/dev/console                devpts[/0]                                                                           devpts  rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=666
| |-/dev/pts                    devpts                                                                               devpts  rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=666
| |-/dev/mqueue                 mqueue                                                                               mqueue  rw,nosuid,nodev,noexec,relatime
| `-/dev/shm                    shm                                                                                  tmpfs   rw,nosuid,nodev,noexec,relatime,size=65536k
|-/sys                          sysfs                                                                                sysfs   ro,nosuid,nodev,noexec,relatime
| |-/sys/firmware               tmpfs                                                                                tmpfs   ro,relatime
| `-/sys/fs/cgroup              tmpfs                                                                                tmpfs   ro,nosuid,nodev,noexec,relatime,mode=755
|   |-/sys/fs/cgroup/cpuset     cpuset[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]     cgroup  ro,nosuid,nodev,noexec,relatime,cpuset
|   |-/sys/fs/cgroup/cpu        cpu[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]        cgroup  ro,nosuid,nodev,noexec,relatime,cpu
|   |-/sys/fs/cgroup/cpuacct    cpuacct[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]    cgroup  ro,nosuid,nodev,noexec,relatime,cpuacct
|   |-/sys/fs/cgroup/blkio      blkio[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]      cgroup  ro,nosuid,nodev,noexec,relatime,blkio
|   |-/sys/fs/cgroup/memory     memory[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]     cgroup  ro,nosuid,nodev,noexec,relatime,memory
|   |-/sys/fs/cgroup/devices    devices[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]    cgroup  ro,nosuid,nodev,noexec,relatime,devices
|   |-/sys/fs/cgroup/freezer    freezer[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]    cgroup  ro,nosuid,nodev,noexec,relatime,freezer
|   |-/sys/fs/cgroup/net_cls    net_cls[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]    cgroup  ro,nosuid,nodev,noexec,relatime,net_cls
|   |-/sys/fs/cgroup/perf_event perf_event[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8] cgroup  ro,nosuid,nodev,noexec,relatime,perf_event
|   |-/sys/fs/cgroup/net_prio   net_prio[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]   cgroup  ro,nosuid,nodev,noexec,relatime,net_prio
|   |-/sys/fs/cgroup/hugetlb    hugetlb[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]    cgroup  ro,nosuid,nodev,noexec,relatime,hugetlb
|   |-/sys/fs/cgroup/pids       pids[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]       cgroup  ro,nosuid,nodev,noexec,relatime,pids
|   `-/sys/fs/cgroup/systemd    cgroup[/docker/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8]     cgroup  ro,nosuid,nodev,noexec,relatime,name=systemd
|-/etc/resolv.conf              /dev/sda1[/docker/containers/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8/resolv.conf]
|                                                                                                                    ext4    rw,relatime,stripe=1024,data=ordered
|-/etc/hostname                 /dev/sda1[/docker/containers/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8/hostname]
|                                                                                                                    ext4    rw,relatime,stripe=1024,data=ordered
`-/etc/hosts                    /dev/sda1[/docker/containers/612f6247d0b7cae71c1373076d88f1b71f44e7fc44c5535564052260e2ed3ab8/hosts]
                                                                                                                     ext4    rw,relatime,stripe=1024,data=ordered
```

You can find the same content in the container at the following location 
`/proc/self/mountinfo`.

This looks interesting, `/etc/hosts` appears to be a [_bind mount_](http://man7.org/linux/man-pages/man8/mount.8.html) where the
source comes from another filesystem.
(For a more human and comprehensive answer check this [StackExchange answer](https://unix.stackexchange.com/questions/198590/what-is-a-bind-mount)).

So like some other tooling when there's a _filesystem boundary_ `inotify` 
encounter some limitations in it's ability to report events, their man page 
is not quite clear on the matter :

> Limitations and caveats
>       The inotify API provides no information about the user or process
>       that triggered the inotify event.  In particular, there is no easy
>       way for a process that is monitoring events via inotify to
>       distinguish events that it triggers itself from those that are
>       triggered by other processes.
>
>       *Inotify reports only events that a user-space program triggers
>       through the filesystem API.*  As a result, it does not catch remote
>       events that occur on network filesystems.  *(Applications must fall
>       back to polling the filesystem to catch such events.)*  Furthermore,
>       various pseudo-filesystems such as /proc, /sys, and /dev/pts are not
>       monitorable with inotify.
>
>       The inotify API does not report file accesses and modifications that
>       may occur because of mmap(2), msync(2), and munmap(2).

source: [man7.org](http://man7.org/linux/man-pages/man7/inotify.7.html)

For `/etc/hosts` and some other specific files this causes some trouble
for many different tool, e.g (non exhaustive list of issues).

* https://github.com/docker/for-mac/issues/2375
* https://github.com/moby/moby/issues/11705
* https://github.com/libuv/libuv/issues/1201


## How to fix this

So you're left with two approaches: 

* Either poll the file regularly 
* or get yourself an implementation that uses the right `inotify` 
  abstraction (i.e. that do not only allow to watch folder).

Some implementations exists for both approach, I wouldn't list or recommend any
because I'm not yet sure if they should be trusted at this time.



---------------------

XXXXXX TODO

* why the Java watchservice only allow to register folders ?
* Why not allowing a modifier to tweak the inotify usage ?

We could have hoped for a way to tweak the behavior but the linux implementation
do not yet support any modifiers ([`// no modifiers supported at this time`](http://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java#l230))