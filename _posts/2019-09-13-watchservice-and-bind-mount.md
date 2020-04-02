---
layout: post
title: When Java's WatchService is not the right tool in a container
date: 2019-09-13
published: true
tags:
- Java
- Linux
- docker
- kubernetes
- inotify
- WatchService
author: Brice Dutheil
language: en
---

## Boring code that should be written once and run everywhere

Suppose the application you're working on needs to monitor changes to a 
file and rely on Java's `WatchService` introduced in Java 7. Development 
and test on the local machine works ; the unit tests rely on a 
`TemporaryFolder` Junit rule as you want to control the content of the file, 
running the code on the actual machine just works as expected.
Everything is green to go live.

The file is `/etc/hosts` (that's important).

However, when the application is live in production, nothing happen when
the file is modified.



The code to reproduce this issue is quite boring:


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

### Running this code locally (on a physical machine)

This simple code expects an argument that is a path to a directory or, a file.
When this code is run locally on the physical machine:

```
############ terminal A ##############|############ terminal B ###########
> java WatchFile /etc/hosts           | 
Watching : /etc/hosts                 | # wait for WatchFile to be started
                                      | > touch /etc/hosts
Modified : hosts                      |
  -> : /etc/hosts                     |
```

The code work as expected.

### Running this code in a container

Then we are running in a container (and on Linux), expecting the following should 
just work. _Write once run everywhere!_

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

But no, it doesn't ! If it works fine on a physical machine, and 
in a JUnit test what is happening for this code to not work within a container ?!


## Understanding how this code is working differently on these two platforms

When using `WatchService` the first thing to understand about it is that 
it tries to abstract filesystems and platform facilities regarding file 
changes that happen on the file-system. However, while the API tries 
its best to be platform agnostic there are substantial variations in behavior 
in each platform implementation.

For example the JDK 8 on MacOs the following statement 
`FileSystems.getDefault().newWatchService()` will return a very basic 
[polling watcher](https://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/share/classes/sun/nio/fs/PollingWatchService.java), 
other platforms integration code may benefit from more intimate knowledge of the OS 
and the file-system. Linux uses `inotify` and its integration appears to leverage it.


### Linux Watch Service uses `inotify`

The above code works on almost any - if not all - Linux physical box. 
What's wrong then? First let's dig a little bit in the `WatchService` 
Linux implementation.

Depending on the installed JDK distribution `sun.nio.fs.LinuxWatchService`
may or may not be available, however the source is available in the JDK 
repository.
[`sun.nio.fs.LinuxWatchService`](https://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java)
makes use of `inotify` and `inotify` has been around for a long time, it 
is a proven technology to watch file-system events on Linux. 

The issue has to be between the chair and the keyboard!


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
upon file-system change events. So let's try with the system tools in our 
container in order to have a quick understanding of how it works.

First install `inotify-tools` in the running container.

```bash
root@612f6247d0b7:/# apt-get update
...
root@612f6247d0b7:/# apt-get install -y inotify-tools
```

Then let's add a watch on `/etc/hosts` in shell session _A_, once 
_established_ modify the watched file in session _B_.

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

In terminal _A_, the expected events are being observed, meaning that `inotify` 
appears to be working as desired.

The question remains ; why is this working when using system tools but not in 
the Java program?


Now remember that the Java `WatchService` API only allow to register a directory.

```java
/**
 * A watch service that <em>watches</em> registered objects for changes and
 * events. For example a file manager may use a watch service to monitor a
 * directory for changes so that it can update its display of the list of files
 * when files are created or deleted.
 * ...
 */
```

So let's try again with a watch on the `/etc` folder instead following the 
same scenario: in shell session _A_ set-up a watch, then once ready modify 
the actual file in session _B_:

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

The first thing to notice is that in terminal _A_, a different set of events 
are being observed ; but neither `ATTRIB` or `MODIFY` events and there's something 
especially that catches our attention: the events are about `ld.so.cache`.

That's unexpected, let's try the same scenario on a different file in `/etc`,
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

OK, we've got `ld.so.cache` events plus the wanted events. If we run our 
Java `WatchFile` program it is notified by the file change, as expected.

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

This raises questions about `/etc/hosts` in particular, there is something that 
prevents `inotify` to see the change if the watch is set up on the parent directory.

In the example with `/etc/hosts`, `inotify` only emitted `OPEN`, 
`CLOSE_NO_WRITE` and `CLOSE` events, those events alone are not what 
the Linux implementation expects in order to be notified of file 
modifications ([source code (line 382)](https://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java#l382)).


## The clue

When reading the javadoc of `WatchService` one paragraph caught my eye :

```java
/**
 * ...
 * <p> If a watched file is not located on a local storage device then it is
 * implementation specific if changes to the file can be detected. In particular,
 * it is not required that changes to files carried out on remote systems be
 * detected.
 * ...
 */
```

This means that changes carried out on remote filesystems may not be detected.
It's natural to think that `/etc/hosts` is present on the local filesystem, but 
this code run in a container, and containers ~~may~~ do fancy stuff especially 
on the `hosts` file.

Let's have a look at mounts:

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

> _You can find the same content in the container at the following location 
> `/proc/self/mountinfo`._

The information above looks interesting, `/etc/hosts` appears to be a 
[_bind mount_](http://man7.org/linux/man-pages/man8/mount.8.html) where the
source comes from another filesystem.
(To understand better what is a bind mound there's a more human and 
pedagogic explanation in this 
[StackExchange answer](https://unix.stackexchange.com/questions/198590/what-is-a-bind-mount)).

When there's a _filesystem boundary_ `inotify` encounter some 
limitations in its ability to report events, the man page 
is not quite clear on the matter though:

> ```
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
> ```

source: [man7.org](http://man7.org/linux/man-pages/man7/inotify.7.html)

What this mean is that for some files and for `/etc/hosts` in this case 
this constraint may cause some misbehavior for some tools, 
e.g (non exhaustive list of issues) :

* https://github.com/docker/for-mac/issues/2375
* https://github.com/moby/moby/issues/11705
* https://github.com/libuv/libuv/issues/1201

Concretely this explains why the code was working when being tested with 
JUnit 4's `TemporaryFolder` and on a physical machine because the watched 
was not _bind mounted_.

## How to fix this

This knowledge is interesting, but the program still has to watch changes to this 
file which in practice suggests two approaches: 

1. Either poll the file regularly
2. or use an implementation that leverage the right `inotify` 
   abstraction (i.e. that do not only allow to watch folder).

Implementations for both approaches exist. However, at this time 
I'm uneasy to share a list or to recommend any as I do not have 
sufficient experience with the second alternative and as such unable to 
make a critical assessment comparing both.

Typically, when watching files there's some tricky details that cannot 
be overlooked when using the whole set of events offered by `inotify` 
or when considering other OS native file watching API. Additionally, 
this may very well depend on the actual use case that has to be solved.

Note that this happened on `/etc/hosts`, but the same issue can happen 
on any file that is _bind mounted_ in the container, like it is customary 
for configuration files (configmap) in Kubernetes.


## Remaining questions

The Java's `WatchService` design targets both simplicity and portability at 
a time when containers (and their funky filesystem) were not a thing.

The API is flexible enough to enable the usage of the platform 
specific features. I'm certainly hoping for a way to tweak the 
behavior of the Linux integration as the current one does not 
yet support any modifiers 
([`// no modifiers supported at this time`](https://hg.openjdk.java.net/jdk8u/jdk8u/jdk/file/478a4add975b/src/solaris/classes/sun/nio/fs/LinuxWatchService.java#l230))

This could be implemented this way:

> The WatchService API allows customization using _modifiers_ 
> `WatchKey Path.register(WatchService watcher, WatchEvent.Kind<?>[] events, WatchEvent.Modifier... modifiers)`.
> For example `com.sun.nio.file.SensitivityWatchEventModifier`.
> Using this, it could be possible to tweak `inotify` usage.

Also, why the Java watchservice only allow to register folders ? 
Since there is some differences in the implementation already
why not relaxing the limitation for implementation to allow them 
to watch files and in the case of Linux it would allow to leverage 
the `inotify` event model. For backward compatibility this could be 
enabled only when the right modifier is passed to `Path.register(...)`.

At this time I could only find these discussions on the matter:

* http://mail.openjdk.java.net/pipermail/nio-dev/2010-September/thread.html#1059
* http://mail.openjdk.java.net/pipermail/nio-dev/2010-September/001070.html
