---
layout: post
title: Pagination en JAX-RS 2.0 avec le header Link
date: 2017-10-02
published: true
tags:
- java
- jaxrs
- pagination
- http
- github
author: Brice Dutheil
---

Votre API REST est en place, mais voilà une des resources doit être paginée.
Quelqu'en soit la raison, API de recherche, API de listing, etc.

Il y a plusieurs choix possible sur la manière de faire :

* Ne rien faire c'est le client qui contrôle tout pour lister les pages
* Dans le body HTTP, envelopper la liste de résultat contenant également les
  informations de pagination. C'est une approche souvent choisi car elle demande
  moins de connaissance du HTTP.
* Utiliser la réponse HTTP comme enveloppe et système de meta-données. C'est
  l'option choisie par les designers de
  l'[API HTTP de GitHub](https://developer.github.com/v3/guides/traversing-with-pagination/)

Les gens de Github utilisent spécifiquement l'entête `Link` pour exprimer les
_relations_ des pages dans une ressource paginée. Pour ceux qui n'ont pas envie
d'utiliser le body de la réponse pour introduire ces _méta-données_ de
navigations, cet article explique comment mettre en place avec le standard
JAX-RS 2 un mécanisme comme celui de GitHub.



## Qu'est-ce que le header link?

D'après la [RFC 5988](https://tools.ietf.org/html/rfc5988) :


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

La RFC donne cet exemple :

```
Link: <http://example.com/TheBook/chapter2>; rel="previous"; title="previous chapter"
```

L'entête `Link` est donc un moyen de donner au client les URIs des relations
de la ressource actuelle.
Le header HTTP `Link` peut accueillir plusieurs _link_, donc plusieurs
relations. Ce qui permet de donner les liens pour naviguer d'une page à une
autre comme l'a mis en place github. **La réponse HTTP est l'enveloppe de
la payload**.

## JAX-RS, le prototypage

Concrètement comment implémenter cette forme de pagination en JAX-RS ?

On peut utiliser le builder de `Response` pour ajouter le header `Link`. Depuis
la spécification JAX-RS 2 il y a un support spécifique pour les header `Link`,
via le builder `.links(Link...)` et via la classe `Link`.


```java
Response.ok()
        .links(Link.valueOf("<https://host:port/path?q=foo&page=72>; rel=\"previous results\""),
               Link.valueOf("<https://host:port/path?q=foo&page=74>; rel=\"next results\""))
        .entity(/* page 73 */ results)
        .build());
```

Ce qu'il nous faut donc c'est l'URI complète pour générer les URI des relations.
Avec JAX-RS, il faut récupérer `UriInfo`. Pour rappel :

Étant donné l'URI appelée `http://localhost:59520/path/to/search?foo=bar&qix=zzz`, alors

* `uriInfo.getAbsolutePath()` donnera `http://localhost:59520/path/to/search`
* `uriInfo.getBaseUri()` donnera `http://localhost:59520/`
* `uriInfo.getPath()` donnera `path/to/search`
* `uriInfo.getQueryParameters()` donnera une `MultivaluedMap` avec
  ```
  "foo" : ["bar"]
  "qix" : ["zzz"]
  ```
* `uriInfo.getRequestUri()` donnera `http://localhost:59520/path/to/search?foo=bar&qix=zzz`

Dans le contexte d'une ressource JAX-RS, on peut par exemple écrire le code
suivant.

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

Ce code laisse la responsabilité à la classe `LinkPagination` de générer les
headers `Link`.

```java
import com.google.common.base.Preconditions;

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

La méthode `toLinks()` va déterminer quelles relations existent. Cette
implémentation suit des choix , comme le fait de ne pas renvoyer la relation
 _self_, et bien sûr d'autres peuvent être choisit.

`uriInfo` est utilisé pour construire la nouvelle URI avec une méthode pratique
sur le builder, `replaceQueryParam(paramName,value)`. Cette approche
demande de s'assurer que le paramètre de la requête ait bien le même nom ; il
est indispensable d'uniformiser dans l'application un minimum les mécanismes
de pagination, par exemple la classe `QueryParams` utilise une constante
pour le paramètre de la page :

```java
@Data
public class QueryParams {
    @QueryParam("q") String question;

    @Min(value = 1, message = "page start at 1")
    @QueryParam(PAGE_QUERY_PARAM) @DefaultValue("1") Integer page;
}
```

Enfin il faut remarquer que s'il y a beaucoup de resources paginées, alors
il y a un problème de design. En effet, le code a plus de chance d'être cassé,
ou d'avoir des différences s'il est dupliqué à plusieurs endroits.
Il y a moyen de faire mieux.

## JAX-RS, une solution plus générique

JAX-RS apporte depuis la version 2.0 la notion de _filtre_ qui s'appliquent sur
le _pipeline_ de la requête. Il y a deux types de filtre, l'un sur la requête,
le deuxième sur la réponse. Nous sommes ici intéressés par "filtrer" la réponse
Le code qui suit implémente à cet effet l'interface `ContainerResponseFilter`
pour identifier identifier une _entité_ **paginée** et de modifier la réponse en
conséquence.


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

De la même manière on a besoin de `UriInfo` pour reconstruire les liens des
relations. En revanche l'API du `ContainerResponseContext` est un peu moins
confortable que le builder de `Response`, notamment pour ajouter les entêtes à
la requête HTTP, il n'y a pas par exemple de symétrie avec le `.links()`.

On indique que `SomePaginated` dispose du contrat `Paginated` :

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

Puis il suffira d'écrire :

```java
@GET @Path("search")
public void search(@BeanParam QueryParams queryParams,
                   @Suspended AsyncResponse asyncResponse) {

    SomePaginated results = // get paginated results
    asyncResponse.resume(results);
}
```

Ce qui permet d'être simple à mettre en place pour des resources ultérieures.
Le code technique est géré à un seul endroit et évite donc les détériorations
possibles si le code était dupliqué sur plusieurs resources.

# Éléments à prendre en compte

* Faut-il utiliser une IRI absolue ou relative?

  Par exemple l'api pourrait être utilisée par un serveur intermédiaire exposé 
  sur un autre domaine, rendant l'exploitation de ces liens délicate.

* Faut-il pour la payload utiliser un type collection ou un type objet?

  Un tableau a l'avantage de représenter une collection d'éléments directement.
  Cependant pour des raisons métier il pourrait être voulu que le serveur 
  retourne également des méta-données métiers sur cette collection :
  un flag d'A/B testing, pour une recherche quelles options étaient actives, 
  etc. Ces informations peuvent être exposée dans les entêtes, mais est-ce 
  le bon endroit?

* Ce qui amène alors à une autre réflexion si ces meta-donnés sant dans la 
  payload, est-ce les informations de paginations devrait y être aussi ?

  Mon avis est que non car la pagination est une notion liée au protocole
  d'accès à la données, alors que les meta-données du métiers ne le sont 
  pas. Également le fait que ces données soient dans les entêtes n'oblige 
  pas à parser la payload pour les utiliser.

------------------------------

Sur le même sujet mais relatif au traitement même de la requête de pagination,
mais relatif uniquement à Jersey
l'[article suivant](https://psamsotha.github.io/jersey/2017/01/07/jersey-pagination-with-spring-data.html)
