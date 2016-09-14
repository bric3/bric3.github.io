---
layout: post
title:
date: 2016-07-25
published: false
tags:
- instrumentation
- bytebuddy
author: Brice Dutheil
---

Lancer la JVM ciblée avec l'option : `-XX:NativeMemoryTracking=summary`


Enfin depuis la console lancer :  `jcmd <pid> VM.native_memory summary`



```
Total:  reserved=664192KB,  committed=253120KB                                           <--- total memory tracked by Native Memory Tracking

-                 Java Heap (reserved=516096KB, committed=204800KB)                      <--- Java Heap
                            (mmap: reserved=516096KB, committed=204800KB)

-                     Class (reserved=6568KB, committed=4140KB)                          <--- class metadata
                            (classes #665)                                               <--- number of loaded classes
                            (malloc=424KB, #1000)                                        <--- malloc'd memory, #number of malloc
                            (mmap: reserved=6144KB, committed=3716KB)

-                    Thread (reserved=6868KB, committed=6868KB)
                            (thread #15)                                                 <--- number of threads
                            (stack: reserved=6780KB, committed=6780KB)                   <--- memory used by thread stacks
                            (malloc=27KB, #66)
                            (arena=61KB, #30)                                            <--- resource and handle areas

-                      Code (reserved=102414KB, committed=6314KB)
                            (malloc=2574KB, #74316)
                            (mmap: reserved=99840KB, committed=3740KB)

-                        GC (reserved=26154KB, committed=24938KB)
                            (malloc=486KB, #110)
                            (mmap: reserved=25668KB, committed=24452KB)

-                  Compiler (reserved=106KB, committed=106KB)
                            (malloc=7KB, #90)
                            (arena=99KB, #3)

-                  Internal (reserved=586KB, committed=554KB)
                            (malloc=554KB, #1677)
                            (mmap: reserved=32KB, committed=0KB)

-                    Symbol (reserved=906KB, committed=906KB)
                            (malloc=514KB, #2736)
                            (arena=392KB, #1)

-           Memory Tracking (reserved=3184KB, committed=3184KB)
                            (malloc=3184KB, #300)

-        Pooled Free Chunks (reserved=1276KB, committed=1276KB)
                            (malloc=1276KB)

-                   Unknown (reserved=33KB, committed=33KB)
                            (arena=33KB, #1)
```

Sources :
* [Description de l'outillage NMT](https://docs.oracle.com/javase/8/docs/technotes/guides/troubleshoot/tooldescr007.html)
* [Guide Native Memory Tracking](https://docs.oracle.com/javase/8/docs/technotes/guides/vm/nmt-8.html)
