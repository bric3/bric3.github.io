---
authors: ["brice.dutheil"]
date: "2018-02-20T00:00:00Z"
language: en
published: false
tags:
- java
- jaxrs
- URL
- URI
- Retrofit
- OkHttp
- HttpUrl
- leading
- trailing
- opinion
slug: URI_paths_with_trailing_or_leading_slashes
title: Opinion, should we prefix JAX-RS Path value with a slash ?
---

In the past months I have been using extensively the infamous HTTP client 
OkHTTP, I have been impressed by the will power of committers to respect 
HTTP standards. My co-workers which have various degrees of knowledge and experience
in different language ecosystem work on a server-side application with some JAX-RS 
endpoints, and this question arose:

> Should we prefix or not by a slash the path value in `@Path` annotations ?

Having worked for ~~so~~ _too_ many years with JAX-RS endpoints I always liked paths
pre-pended with a slash. However after working with OkHttp's `HttpUrl` I started 
to notice that JAX-RS was a bit non standard and may even be confusing for some.

JAX-RS resolves URL paths with leading slashes the same way as without leading 
slashes, although the preferred way is without leading slash.

> A `@Path` value isn’t required to have leading or trailing slashes (/). The 
> JAX-RS runtime parses URI path templates the same whether or not they have 
> leading or trailing spaces. [\[1\]][1]

More specifically the JAX-RS [`@Path`][2] documentation says : 

> Paths are relative. For an annotated class the base URI is the application 
> path, see `ApplicationPath`. For an annotated method the base URI is the 
> effective URI of the containing class. For the purposes of absolutizing a 
> path against the base URI , a leading '/' in a path is ignored and base URIs 
> are treated as if they ended in '/'.

So an `ApllicationPath` can define a path that will be pre-pended anyway. And anyway 
the JAX-RS endpoints are registered in a servlet that can be set-up in a context 
path in the application container.

Now if you know how Linux filesystem work, a leading slash usually indicates
the root of the filesystem. And the web people understood that in order to 
_access_ server resources some rules had to be made, they did create the
[RFC 3886](https://tools.ietf.org/html/rfc3986). This document explains how 
a URI is structured : 


```
         foo://example.com:8042/over/there?name=ferret#nose
         \_/   \______________/\_________/ \_________/ \__/
          |           |            |            |        |
       scheme     authority       path        query   fragment
          |   _____________________|__
         / \ /                        \
         urn:example:animal:ferret:nose
```

and in the path section the document identifies two kind
of path absolute and relative




**But**, this interface is for Retrofit / OkHttp, which use his own [`HttpUrl`][4] class for resolving resolving the path the retrofit annotation (e.g. [`@POST`][5]). Those annotations allows relating or absolute paths. And since it uses `HttpUrl.resolve` method, the leading slash in the url of the annotation is resolved as an absolute path, e.g. right after the authority. Everything is explained in this Retrofit [documentation][6].

**So the leading or trailing slashes are not code cosmetic, but involves different semantic in the URL resolution, especially client side.**


That's what browsers do, when resolving urls. It is the RFC 3886, and here's the tests in OkHttp.


Actually there's a rationale behind the leading or trailing slash `/` in the URL, (notice I didn't format URL), it is because of URL resolution. 



[1]: https://docs.oracle.com/cd/E19798-01/821-1841/ginpw/
[2]: https://docs.oracle.com/javaee/7/api/javax/ws/rs/Path.html
[3]: https://cdivilly.wordpress.com/2014/03/11/why-trailing-slashes-on-uris-are-important/
[4]: https://square.github.io/okhttp/3.x/okhttp/okhttp3/HttpUrl.html
[5]: http://square.github.io/retrofit/2.x/retrofit/retrofit2/http/POST.html#value--
[6]: http://square.github.io/retrofit/2.x/retrofit/retrofit2/Retrofit.Builder.html#baseUrl-okhttp3.HttpUrl-
[7]: https://docs.oracle.com/cd/E19798-01/821-1841/6nmq2cp26/index.html