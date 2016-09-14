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

```java
package com.libon.server.auth.startup;

import static java.util.stream.Collectors.joining;
import static net.bytebuddy.implementation.MethodDelegation.to;
import static net.bytebuddy.matcher.ElementMatchers.any;
import static net.bytebuddy.matcher.ElementMatchers.named;
import java.lang.instrument.Instrumentation;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.bytebuddy.agent.ByteBuddyAgent;
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.implementation.SuperMethodCall;
import net.bytebuddy.implementation.bind.annotation.AllArguments;
import net.bytebuddy.implementation.bind.annotation.FieldValue;
import net.bytebuddy.implementation.bind.annotation.Origin;

public class KafkaNetworkReceiveInterceptor {

    private static Logger logger = LoggerFactory.getLogger(KafkaNetworkReceiveInterceptor.class);

    public static class readFromReadableChannel {
        public static void log(@AllArguments Object[] allArguments,
                               @Origin Method method,
                               @FieldValue("size") ByteBuffer size) {
            logger.warn("HEAP-ISSUE: method : '{}.{}', this.receiveSize={}",
                        method.getDeclaringClass().toString(),
                        method.getName(),
                        size == null ? null : size.getInt());
            if (size != null) {
                size.rewind();
            }
        }
    }

    public static class NetworkReceiveConstructor {
        public static void log(@AllArguments Object[] allArguments) {
            logger.warn("HEAP-ISSUE: constructor : " + Arrays.stream(allArguments)
                                                             .map(Object::getClass)
                                                             .map(Class::getSimpleName)
                                                             .collect(joining()));
        }
    }


    public static void installAgent() {
        Instrumentation instr = ByteBuddyAgent.install();

        new AgentBuilder.Default()
                .type(named("org.apache.kafka.common.network.NetworkReceive"))
                .transform((builder, typeDescription, classLoader) -> builder
                        .constructor(any())
                        .intercept(to(NetworkReceiveConstructor.class).andThen(SuperMethodCall.INSTANCE))
                        .method(named("readFromReadableChannel"))
                        .intercept(to(readFromReadableChannel.class).andThen(SuperMethodCall.INSTANCE))
                ).installOn(instr);
    }
}
```



```java
package com.libon.server.auth.startup;

import static java.lang.String.format;
import static java.util.stream.Collectors.joining;
import static net.bytebuddy.implementation.MethodDelegation.to;
import static net.bytebuddy.matcher.ElementMatchers.any;
import static net.bytebuddy.matcher.ElementMatchers.named;
import java.io.EOFException;
import java.io.IOException;
import java.lang.instrument.Instrumentation;
import java.nio.ByteBuffer;
import java.nio.channels.ReadableByteChannel;
import java.util.Arrays;
import java.util.Objects;
import org.apache.kafka.common.network.InvalidReceiveException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.bytebuddy.agent.ByteBuddyAgent;
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.implementation.SuperMethodCall;
import net.bytebuddy.implementation.bind.annotation.AllArguments;
import net.bytebuddy.implementation.bind.annotation.Argument;
import net.bytebuddy.implementation.bind.annotation.FieldProxy;
import net.bytebuddy.implementation.bind.annotation.FieldValue;

public class KafkaNetworkReceiveInterceptor {

    private static Logger logger = LoggerFactory.getLogger(KafkaNetworkReceiveInterceptor.class);

    public static class Replace_ReadFromReadableChannel {

        public static final int UNLIMITED = -1;

        public static long replace(
                @Argument(0) ReadableByteChannel readableByteChannel,
                @FieldProxy("buffer") Get<ByteBuffer> bufferGetter,
                @FieldProxy("buffer") Set<ByteBuffer> bufferSetter,
                @FieldValue("size") ByteBuffer size,
                @FieldValue("maxSize") int maxSize
                ) throws IOException {

            return readFromReadableChannel(
                    readableByteChannel,
                    size,
                    maxSize,
                    bufferGetter,
                    bufferSetter
            );
        }


        static long readFromReadableChannel(
                ReadableByteChannel channel,
                ByteBuffer size,
                int maxSize,
                Get<ByteBuffer> bufferGetter,
                Set<ByteBuffer> bufferSetter
        ) throws IOException {
            int read = 0;
            if (size.hasRemaining()) {
                int bytesRead = channel.read(size);
                if (bytesRead < 0)
                    throw new EOFException();
                read += bytesRead;
                if (!size.hasRemaining()) {
                    size.rewind();
                    int receiveSize = size.getInt();
                    logger.warn("HEAP-ISSUE: method : NetworkReceive.readFromReadableChannel.receiveSize={}",
                                receiveSize);

                    if (receiveSize < 0)
                        throw new InvalidReceiveException("Invalid receive (size = " + receiveSize + ")");
                    if (maxSize != UNLIMITED && receiveSize > maxSize)
                        throw new InvalidReceiveException("Invalid receive (size = " + receiveSize + " larger than " + maxSize + ")");

                    ByteBuffer newBuffer = ByteBuffer.allocate(receiveSize);

                    bufferSetter.set(newBuffer);
                }
            }
            ByteBuffer bufferValue = bufferGetter.get();
            if (bufferValue != null) {
                int bytesRead = channel.read(bufferValue);
                if (bytesRead < 0)
                    throw new EOFException();
                read += bytesRead;
            }

            return read;
        }
    }

    public interface Get<T> {
        T get();
    }

    public interface Set<T> {
        void set(T value);
    }

    public static class Log_NetworkReceiveConstructor {
        public static void logConstructorArgs(@AllArguments Object[] allArguments) {
            logger.warn("HEAP-ISSUE: constructor : " + Arrays.stream(allArguments)
                                                             .map(o -> format("%s='%s'",
                                                                              o.getClass().getSimpleName(),
                                                                              Objects.toString(o)))
                                                             .collect(joining(", ")));
        }
    }


    public static void installAgent() {
        Instrumentation instr = ByteBuddyAgent.install();

        new AgentBuilder.Default()
                .type(named("org.apache.kafka.common.network.NetworkReceive"))
                .transform((builder, typeDescription, classLoader) -> builder
                        .constructor(any())
                        .intercept(to(Log_NetworkReceiveConstructor.class).andThen(SuperMethodCall.INSTANCE))
                        .method(named("readFromReadableChannel"))
                        .intercept(to(Replace_ReadFromReadableChannel.class))
                ).installOn(instr);
    }
}
```
