---
authors: ["brice.dutheil"]
date: "2011-10-21T20:06:46Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
published: true
status: publish
tags:
- code
- intellij
- mockito
- TDD
- template
- test
- test unitaire
slug: quelques-live-template-intellij-pour-mockito
title: Quelques Live Template IntelliJ pour Mockito
type: post
---
Hello, j'en avais un peu marre d'écrire régulièrement voire répétitivement dans mes tests les constructions mockito.

Pour ça je me suis créé dans mon IDE favori, [IntelliJ](http://www.jetbrains.com/idea/), ce qu'on appelle des Live Template. Ces templates permettent à partir d'une abréviation d'insérer des fragments de code. Ainsi par exemple :

Taper `iter` dans votre éditeur puis de faire <kbd>Ctrl+J</kbd> (sous OSX) va développer cette abréviation dans le bout de code ci-dessous (suivant le contexte bien entendu)

```java
for (TypeInIterable type : someIterable) {

}
```

Taper sur <kbd>Ctrl+J</kbd> (sous OSX) vous permet de lister les abréviations disponible dans le contexte courant.

# Les Live Template pour Mockito

Bien qu'imparafaite pour des raisons de limite technique d'IntelliJ, elles sauvent un minimum de temps, multiplié par le nombre de test. Malheureusement il n'y a pas non plus d'import export uniquement pour les live template, il faut donc se taper la configuration de intellij à la main. Cela dit il est possible de contourner partiellement ce problème avec la sauvegarde de la configuration personnelle sur les serveurs intellij, ou encore d'exporter la configuration pour les live templates, les file templates, et encore autre chose.

J'ai défini toutes ces annotations dans un nouveau groupe **test**, et j'ai activé pour toutes le contexte Java, avec reformatage et simplification du nom qualifié.

------------------------------------
* Description : Creates a field with the `@Mock` annotation
* Abbréviation : `am`
* Template text :

```java
@org.mockito.Mock private $TYPE$ $MOCK_FIELD$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| TYPE | variableOfType("Object") | | |
| MOCK_FIELD | suggestVariableName() | | |

</div>

------------------------------------
* Description : Creates a field with the `@Spy` annotation
* Abbréviation : `as`
* Template text :

```java
@org.mockito.Spy private $TYPE$ $MOCK_FIELD$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| TYPE | variableOfType("Object") | | |
| MOCK_FIELD | suggestVariableName() | | |

</div>


------------------------------------
* Description : Creates a field with the `@InjectMocks` annotation
* Abbréviation : `aim`
* Template text :

```java
@org.mockito.InjectMocks private $TYPE$ $MOCK_FIELD$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| TYPE | variableOfType("Object") | | |
| MOCK_FIELD | suggestVariableName() | | |

</div>


------------------------------------
* Description : Add `@RunWith(MockitoJUnitRunner.class)`
* Abbréviation : `rwm`
* Template text :

```java
@org.junit.runner.RunWith(org.mockito.runners.MockitoJUnitRunner.class)
```

------------------------------------
* Description : BDD Stub mock with `given(...).willReturn(...)` style
* Abbréviation : `gw`
* Template text :

```java
given($MOCK$).willReturn($ARGS$)$END$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| TYPE | variableOfType("Object") | | |
| ARGS | | | |

</div>


------------------------------------
* Description : BDD Stub spy/mock with `willReturn(...).given(...)` style
* Abbréviation : `wg`
* Template text :

```java
org.mockito.BDDMockito.willReturn($RETURNED$).given($MOCK$).$CALL$ $END$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| RETURNED | complete() | | |
| MOCK | variableOfType("Object") | | |
| CALL | complete() | | |

</div>


------------------------------------
* Description : Inserts a `verify(...)` statement
* Abbréviation : `verif`
* Template text :

```java
org.mockito.Mockito.verify($MOCK$).$CALL$
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| RETURNED | complete() | | |
| MOCK | variableOfType("Object") | | |
| CALL | complete() | | |

</div>


------------------------------------
* Description : Inserts `Mockito.inOrder(mocks)` followed by `inOrder.verify(...)` statements
* Abbréviation : `ioverif`
* Template text :

```java
org.mockito.InOrder $inOrderVar$ = org.mockito.Mockito.inOrder($MOCKS$);

$IN_ORDER_VAR$.verify($MOCK$).$CALL$;
```

* Les variables du templates sont :

<div class="table-wrapper" markdown="block">

| Name | Expression | Default value | Skip if defined |
| :--- | :--- | --- | --- |
| IN_ORDER_VAR | suggestVariableName() | | |
| MOCKS | variableOfType("Object") | | |
| MOCK | variableOfType("Object") | | |
| CALL | complete() | | |

</div>

------------------------------------

Voilà donc les templates que je me suis créé pour IntelliJ, il manque certainement des cas d'utilisation, mais je trouvais plus judicieux de mettre ces cas là au moins. Pour nos amis Eclipse oou Netbeans, il y a des fonctionnalités comparables plus ou moins évoluées (de mémoire le système d'Eclipse est plutôt pas mal).

# Références


* [Live Templates](http://www.jetbrains.com/idea/webhelp/live-templates-2.html)
