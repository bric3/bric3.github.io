---
layout: post
title: Mockito 1.9.0 is out - Bientôt sur les repos maven
date: 2011-12-19 10:37:06.000000000 +01:00
type: post
published: true
status: publish
categories:
- code
- TDD
tags:
- constructor injection
- mockito
- TDD
meta:
  _edit_last: '1'
  _syntaxhighlighter_encoded: '1'
  amazon-product-content-hook-override: '2'
  amazon-product-excerpt-hook-override: '3'
  _su_rich_snippet_type: none
  suf_pseudo_template: default
  amazon-product-newwindow: '3'
author: Brice Dutheil
---
**EDIT:** Hop. Enfin la release 1.9.0 est dispo en téléchargement.

----------------------------------------------------------

Après pas mal de travail avec des périodes plus ou moins intenses - *bref les vicissitudes du développement Open Source* - le projet sort une nouvelle version **1.9.0** en ~~Release Candidate~~, avec des bugfixes et bien sûr des nouvelles features. Il y a un [ici](http://code.google.com/p/mockito/downloads/detail?name=mockito-1.9.0.zip) et bientôt disponible sur le central maven.

* Pour être plus fluent et expressif, l'API introduit les alias `then()` et `will()` pour les réponses personnalisées (`Answer`). Ainsi que d'autres petits tweak de l'API:

```java
@Test
public void engine_should_only_work_with_diesel() {
    given(engine.start()).will(throwExceptionIfEssenceInsteadOfDiesel());
    // ...
}

private Answer throwExceptionIfEssenceInsteadOfDiesel() {
    return new Answer&lt;EngineStatus&gt;() {
        public EngineStatus answer(InvocationOnMock invocation) {
            // answer code
        }
    };
}
```

* Les mocks peuvent maintenant être déclaré dans la configuration du stub, sur une ligne.

```java
DieselEngine de = given(mock(DieselEngine.class).start()).willThrow(TankIsEmpty.class)
                                                         .getMock();
```

* On peut maintenant renvoyer la classe d'une exception plutôt que son instance.

```java
given(someMock).willThrow(IllegalArgumentException.class, SomethingIsWrongException.class);
```

* Si jamais vous avez besoin de debugguer un bout de code ou les interactions sont non prédictibles, il est maintenant possible de loguer les invocations du mock ou de l'espion. Attention, bien qu'utile à l'occasion avec du code legacy, quand même si jamais ce besoin s'en fait sentir sur un nouveau développement c'est que ce code devient trop complexe.

```java
List mockedList = mock(List.class, withSettings().verboseLogging());
mockedList.get(0);
```

On pourra également ajouter des callbacks sur chaque interaction du mock.

```java
Observer observer = mock(Observer.class,
                        withSettings().invocationListeners(listener1, listener2));
willThrow(IllegalArgumentException.class).given(observer.update(observable,
                                                                "what has changed"));
```

* Pas mal de travail a été fait sur les annotations. Maintenant il n'est plus nécéssaire d'initialiser un champ annoté par `@Spy` s'il existe dans la classe un constructeur sans argument.

```java
@RunWith(MockitoJUnitRunner.class)
public class SomeTest {
  // pas besoin d'initialiser le champs
  @Spy private ArrayList spiedArrayList;

  @Test public void verify_some_interactions() {
    spiedArrayList.iterator();
    verify(spiedArrayList, once()).iterator();
  }
}
```

* Et pour la fin mais pas des moindres, le mécanisme d'injection de mockito supporte maintenant l'injection par constructeur. A l'heure actuelle, seul les mocks et spies déclaré dans le test en tant que champs pourront être injecté dans le constructeur du champs annoté par `@InjectMocks`.

```java
@RunWith(MockitoJUnitRunner.class)
public class EngineTest {
  @Mock Diesel diesel;
  @InjectMocks Engine engine;

  @Test public void engine_should_consume_Diesel() {
    engine.start();
  }
}
```

Ou `Engine` a un constructeur avec le paramètre Diesel.

```java
public class Engine {
  Diesel diesel;
  public Engine(Diesel diesel) {
    this.diesel = diesel;
  }

  public boolean start() {
    checkNotEmpty(diesel);
    // ...
  }
  // ...
}
```

Pour l'instant en RC, cette release permettra d'adoucir les angles si nous en avons loupé certains éléments. N'hésitez pas à nous poser des questions sur la [stackoverflow](https://stackoverflow.com/questions/tagged/mockito).
