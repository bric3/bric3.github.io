---
authors: ["brice.dutheil"]
date: "2017-11-20T00:00:00Z"
language: en
published: false
tags:
- java
- jaxrs
- versionning
- http
- jersey
- resteasy
- vendoring
- vendor tree
- mediatype
- media type
slug: API-versioning-with-JAX-RS
title: The Quest to API versioning with JAX-RS
---

# The Quest to API versioning with JAX-RS

> In another post Nottingham adds that we [shouldn’t use a custom header for versioning](http://www.mnot.net/blog/2012/07/11/header_versioning) 
> and touches on versioning through the Accept header but there is a fundamental 
> thread here: try as hard as possible to not introduce breaking changes so that 
> versioning isn’t a big issue.


There is multiple way to address that need.

No versioning within the app, i.e. using a different backend (and as such a 
different authority, host and/or port) for each version

* Versioning via the path
* Query param
* Custom request header
* Via mime-type

The trend is to use the Accept header with the mime-type to express versions.

In this situation there's different approaches, that are not mutually exclusive

1. Using the media type [vendor tree](https://tools.ietf.org/html/rfc6838#section-3.2) (RFC 6838)
    
    In the following request the client asks for the server to produce an `edge.v2.0` 
    json. The `vnd` facet indicate the beginning of the  vendor tree.
    
    ```
    GET /token HTTP/1.1
    Accept: application/vnd.app-api.v2.0+json
    ```

2. Using [media-type parameters](https://tools.ietf.org/html/rfc6838#section-4.3) (RFC 6838)

    In the following request the client asks the server to produce the version 2. 
    The media type is accompanied by the custom version parameter (same way as 
    passing the charset)
    
    ```
    GET /token HTTP/1.1
    Accept: application/json; version=2.0
    ```
    
    The benefit of this approach is that, the code keeps using the standard know 
    media-type here `application/json`, but that it can be customized with named 
    parameters (`version`, `kind`, `experiment`, etc. along with the usual ones 
    like `charset` or `q`).



The good news is that JAX-RS specification also supports parameter constructs 
since version JAX-RS 1.0 : [MediaType](https://docs.oracle.com/javaee/7/api/javax/ws/rs/core/MediaType.html). 
The bad news is that JAX-RS doesn't specify how content negotiation is supposed 
to be handled further that the raw media-type (i.e. without parameters), in 
practice Jersey for example does not handle this case. How to solve the problem :

* The problem can be alleviated by using a pre-matching `ContainerRequestFilter` 
    that will transform the media-type parameter to the vendor tree form.

* It seems that RestEasy (from JBoss / Redhat) understands media-type parameter.

In any case if `version` is not supported the server must send back a 
`406 Not Acceptable` status instead of `404 Not Found`.



Client side, OkHttp 3.9.0 don't understand media-type parameters, but this is 
not a problem in practice as strings constants can be used.



{% if notes %}

HTTP : https://tools.ietf.org/html/rfc2616#section-14.1

> Media ranges can be overridden by more specific media ranges or
> specific media types. If more than one media range applies to a given
> type, the most specific reference has precedence. For example,
>
>     Accept: text/*, text/html, text/html;level=1, */*
>
> have the following precedence:
>
>     1) text/html;level=1
>     2) text/html
>     3) text/*
>     4) */*


{% endif %}

## End words

JAX-RS is NOT HTTP. I really think JAX-RS is one the best specification of the 
JEE bag, but yet again JAX-RS falls short in term of helping Java developers to 
design an HTTP API.

## Motivational reads : 

* http://www.mnot.net/blog/2012/12/04/api-evolution
* https://content.pivotal.io/blog/api-versioning
* https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/
* http://blog.steveklabnik.com/posts/2011-07-03-nobody-understands-rest-or-http#i_want_my_api_to_be_versioned
* https://www.suse.com/communities/blog/best-practice-api-versioning-http-rest-interfaces/
* https://www.daveyshafik.com/archives/35507-mimetypes-and-apis.html




