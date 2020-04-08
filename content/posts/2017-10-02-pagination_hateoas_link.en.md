---
authors: ["brice.dutheil"]
date: "2017-10-02T00:00:00Z"
language: en
published: true
tags:
- java
- jaxrs
- pagination
- http
- github
slug: pagination_hateoas_link.en
title: JAX-RS 2.0 pagination with Link header
---

Your REST API is looking good, everything is ready, but here comes a 
paginated resource. There could be various reasons to do it, be it
search, listing, etc.

In this matter several choices to implement that appear : 

* Do nothing that's the client's job to control everything to iterate over pages

* Wrap the items within an envelope in the HTTP body, this envelope 
  will also contain field having information on the pagination. You can find 
  variation on the exact implementation some choose json-api, some their home
  brewed solution. This is probably the most common approach as this does 
  require less HTTP knowledge. 
  
  And it is likely preferred by pure Javascript clients as there's no need 
  to peek outside the body.

* Use the HTTP response with pagination meta-data being placed in the 
  headers. That's the path chosen by Github in their 
  [v3 API](https://developer.github.com/v3/guides/traversing-with-pagination/).
  That's also this option that this blog post will explore.

More specifically the Github API is using the `Link` header form the HTTP 
standard. It allows express _relations_ and how to reach them for a resource.

API implementors that want separate concerns between the content and the 
pagination could be interested by this article that show a basic setup 
in footsteps of Github and with JAX-RS 2.

## What's the Link header?

The [RFC 5988](https://tools.ietf.org/html/rfc5988) says :


> In this specification, a link is a typed connection between two
> resources that are identified by Internationalised Resource
> Identifiers (IRIs) [RFC3987], and is comprised of:
>
> * A context IRI,
> * a link relation type (Section 4),
> * a target IRI, and
> * optionally, target attributes.
>
> **A link can be viewed as a statement of the form "{context IRI} has a
> {relation type} resource at {target IRI}, which has {target
> attributes}".**

The RFC gives this example :

```
Link: <http://example.com/TheBook/chapter2>; rel="previous"; title="previous chapter"
```

The `Link` header is a way to advertise to the client what are the URIs of
this resource's relations.
This header can also contains several _links_ and so several relations. These 
relations allows a client to _navigate_ from a resource to another ; GitHub 
chose this approach with their V3 API. In other words **the HTTP response is 
the envelope of the payload**.


## JAX-RS, Do it yourself

How to implement this pagination approach with JAX-RS ?

Since JAX-RS 2.0 the `Link` header is specifically supported via the `Link` class
and via the `.links(Link...)` in the `Response` builder.

```java
Response.ok()
        .links(Link.valueOf("<https://host:port/path?q=foo&page=72>; rel=\"previous results\""),
               Link.valueOf("<https://host:port/path?q=foo&page=74>; rel=\"next results\""))
        .entity(page_73_results)
        .build());
```

In the above example, a link is created by parsing an actual Link string with 
the target _IRI_ and other meta-data like the relation parameter.

In order to generate the target IRI, be it relative or absolute, the code would 
need the actual URI data in order to generate all constituent parts of the 
relation. We'll need JAX-RS's `UriInfo` class. As a reminder:

Given the following URI `http://localhost:59520/path/to/search?foo=bar&qix=zzz`, then

* `uriInfo.getAbsolutePath()` will return `http://localhost:59520/path/to/search`
* `uriInfo.getBaseUri()` will return `http://localhost:59520/`
* `uriInfo.getPath()` will return `path/to/search`
* `uriInfo.getQueryParameters()` will return a `MultivaluedMap` with
  ```
  "foo" : ["bar"]
  "qix" : ["zzz"]
  ```
* `uriInfo.getRequestUri()` will return `http://localhost:59520/path/to/search?foo=bar&qix=zzz`

A JAX-RS resource will typically be written like that.

```java
public static String X_TOTAL_COUNT = "X-Total-Count";

@Context
UriInfo uriInfo;

@GET @Path("search")
public void search(@BeanParam QueryParams queryParams,
                   @Suspended AsyncResponse asyncResponse) {

    SamePaginated results = // get paginated results
    LinkPagination linkPagination = new LinkPagination(results.currentPageIndex(),
                                                       results.pageCount())

    asyncResponse.resume(Response.ok()
                                 .links(linkPagination.toLinks(uriInfo)
                                                      .toArray(Link[]::new))
                                 .header(X_TOTAL_COUNT, results.totalCount())
                                 .entity(results.currentPage())
                                 .build());
}
```

Notice the class `LinkPagination` that has the responsibility to create 
the JAX-RS `Link` instances that have to be used in the response builder.

```java
import javax.ws.rs.core.Link;
import javax.ws.rs.core.UriInfo;
import java.util.stream.Stream;

public class LinkPagination {
    public static final String PREV_REL = "prev";
    public static final String NEXT_REL = "next";
    public static final String FIRST_REL = "first";
    public static final String LAST_REL = "last";
    public static final String PAGE_QUERY_PARAM = "page";
    public static final int FIRST_PAGE = 1

    public final int pageCount;
    public final int currentPageIndex;

    public LinkPagination(int currentPageIndex, int pageCount) { /* ... */ }

    public Stream<Link> toLinks(UriInfo uriInfo) {
        if (currentPageIndex == 1 && pageCount == 1) {
            return Stream.empty();
        }

        Stream.Builder<Link> linkStreamBuilder = Stream.builder();

        if (currentPageIndex > 1) {
            linkStreamBuilder.accept(
                Link.fromUriBuilder(uriInfo.getRequestUriBuilder()
                                           .replaceQueryParam(PAGE_QUERY_PARAM,
                                                              currentPageIndex - 1))
                    .rel(PREV_REL)
                    .build());
        }

        if (currentPageIndex < pageCount) {
            linkStreamBuilder.accept(
                Link.fromUriBuilder(uriInfo.getRequestUriBuilder()
                                           .replaceQueryParam(PAGE_QUERY_PARAM,
                                                              currentPageIndex + 1))
                    .rel(NEXT_REL)
                    .build());
        }

        linkStreamBuilder.accept(
            Link.fromUriBuilder(uriInfo.getRequestUriBuilder()
                                       .replaceQueryParam(PAGE_QUERY_PARAM,
                                                          FIRST_PAGE))
                .rel(FIRST_REL)
                .build());

        linkStreamBuilder.accept(
            Link.fromUriBuilder(uriInfo.getRequestUriBuilder()
                                       .replaceQueryParam(PAGE_QUERY_PARAM,
                                                          pageCount))
                .rel(LAST_REL)
                .build());

        return linkStreamBuilder.build();
    }
}
```

The `toLinks()` method's job is to determine which page relations exists 
and emit them if necessary. As a side: when there a Link header there's 
usually _self_ Link, the implementation chose not to emit this 
_self_ relation.

`uriInfo` is used to build the link URI, the Uri builder has useful method
that allows replace query params `replaceQueryParam(paramName,value)`.
This approach require however to make sure the parameter have the same name ;
however as developers we understand that pagination is cross cutting concern
and as such we understand that pagination parameters have to be the same 
across the application. This resource uses the bean param class `QueryParams`
that use a constant for page param.

```java
@Data
public class QueryParams {
    @QueryParam("q") String question;

    @Min(value = 1, message = "page start at 1")
    @QueryParam(PAGE_QUERY_PARAM) @DefaultValue("1") Integer page;
}
```

Obviously this naming constraint could be improved in various ways outside the 
scope of this blog post.

However if there's multiple paginated resources, then we want to avoid 
repeating this code in each JAX-RS resource. Having multiple places with such 
code make more likely to be borken, or harder to benefit from bugfix or updates 
in general. It's time for a better design.

## JAX-RS, a more generic approach

The version 2 of JAX-RS alos brought us _filters_, they are applied on the 
request _pipeline_. There's two type of filters, one integrates in the request 
processing, the second integrates on the response processing. This design 
need to _filter_ the response. The following code implements `ContainerResponseFilter`
to identify a **paginated** payload and to emit the links header in the response.

```java
@Provider
public class LinkPaginationContainerResponseFilter implements ContainerResponseFilter {

    public static final String X_TOTAL_COUNT = "X-Total-Count";
    public static final String X_PAGE_COUNT = "X-Page-Count";

    @Override
    public void filter(ContainerRequestContext requestContext,
                       ContainerResponseContext responseContext) {

        if (!(responseContext.getEntity() instanceof Paginated)) {
            return;
        }

        UriInfo uriInfo = requestContext.getUriInfo();
        Paginated entity = (Paginated) responseContext.getEntity();

        responseContext.setEntity(entity.currentPage);
        responseContext.getHeaders()
                       .addAll(LINK,
                               new LinkPagination(
                                   entity.currentPageIndex(),
                                   entity.pageCount()
                               ).toLinks(uriInfo).toArray(Link[]::new)
                       );
        responseContext.getHeaders().add(X_TOTAL_COUNT, entity.totalCount());
        responseContext.getHeaders().add(X_PAGE_COUNT, entity.pageCount());
    }
}
```

This code uses the request's `UriInfo` in order to build relation links.

As one can notice the API of `ContainerResponseContext` is a bit less 
comfortable to use than the `Response` builder API in the regard of Link 
headers (there's no `.links()` equivalent).

To activate this filter the entity has to implement `Paginated`, let's 
declare it on the business _DTO_ `SomePaginated`.

```java
public interface Paginated<T> {
    T currentPage();
    int currentPageIndex();
    int pageCount();
    int totalCount();
}
```

```java
public class SomePaginated implements Paginated<Page> { /* ... */ }
```

Then the resource code can be written in much more simplier way :

```java
@GET @Path("search")
public void search(@BeanParam QueryParams queryParams,
                   @Suspended AsyncResponse asyncResponse) {

    SomePaginated results = // get paginated results
    asyncResponse.resume(results);
}
```

Any future resource can then return any object representing a pagination
by making the entity class implements `Paginated`. The filter will be the 
only place where bugfix or improvements will take place.

# Things to consider

* Wether the link IRI should be absolute with authority or relative.

  e.g. It may be that there's a front that serves rendered pages on a different 
  domain than the domain of the API.

* Weither the enclosing type of the payload is a collection type or an object.

  An array has the merit to actually represent a collection of items. However
  the server may want to expose business meta-data, related to the items 
  returned, like A/B testing flags, or search flags if is a search, etc. This
  information may be exposed via headers, but is it the right place for 
  business data ?

* That last point lead to another thought, if meta-data are in the payload
  does the pagination data must be there as well ?

  My opinion is it shouldn't. The pagination is elated to the protocol and 
  how to access pages of a resource, while other business related data isn't.
  Besides having this pagination data in the response headers don't force 
  someone to parse the payload to access and use them.

------------------------------

[Blog post](https://psamsotha.github.io/jersey/2017/01/07/jersey-pagination-with-spring-data.html) 
on the same topic but focusing specifically on how to handle
the pagination with a DB and only with Jersey.
