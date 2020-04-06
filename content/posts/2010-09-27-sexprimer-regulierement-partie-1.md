---
authors: ["brice.dutheil"]
date: "2010-09-27T15:52:58Z"
disqus_identifier: 202 http://dutheil.brice.online.fr/blog/?p=202
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
  suf_pseudo_template: default
published: true
status: publish
tags:
- code
- expression régulière
- java
- pattern
- performance
- regex
- regexp
- regular expression
title: Expressions régulières (Partie 1)
type: post
---



# Préambule : Pourquoi cet article ?

Depuis bien longtemps je connais et pratique les expressions régulières, à la fois au moment de coder, mais également
dans mes éditeurs de texte, parfois aussi dans le shell, lors d'un [grep](http://www.panix.com/~elflord/unix/grep.html)
par exemple. Bref les expressions régulières sont pratiques dans la vie de tous les jours pour un ingénieur logiciel.

Seulement voilà je me suis aussi rendu compte que certains d'entre nous n'ont pas une connaissance approfondie
des expressions régulières et de leurs arcanes. Effectivement il y a parfois certaines expressions qui sont
absconses.

# Rappel sur les expressions régulières

Aujourd'hui également les moteurs d'expressions régulières offrent des fonctionnalité qui dépassent le cadre dans
lequel celles-ci ont été conçue. Ce qui permet d'exprimer des _constructions_ peu connues.

Le but à la base est de pouvoir exprimer un motif à rechercher dans une chaine de caractère. Plusieurs mécanismes
existent pour exprimer ces motifs :

* En SQL, il y a pour cela le mot clef `LIKE` et le motif sera composé des métacaractères (wildcard) `%` ou `_`
* Sur un shell on verra plutôt `*`, `?` pour des fichiers. sur les shells bash, zsh, etc. il y a ce qu'on appelle la
    [substitution (expansion) de variables](http://wiki.bash-hackers.org/syntax/pe) qui fournit d'autres règles pour
    les motifs à extraire (ex: `${PARAMETER%%PATTERN}`).

    D'une manière générale ces shells offrent des fonctionnalités plus avancées que `*`, `?` pour manipuler des fichiers
    ou des chaines de caractères connue sous le nom de **globbing**
* Les expressions régulières, le sujet de cette série d'article


## Pourquoi ces expressions sont-elles _régulières_ ?

Sans remonter aux origines des expressions régulières －cette partie là est couverte par
[wikipedia](https://fr.wikipedia.org/wiki/Expression_rationnelle)－ et bien que les expressions
régulières et le moteur associé ont bien évoluées en 60ans la théorie à l'origine de celles-ci reste la même.

Dans la théorie des langagues, il y a ce qu'on appelle le **langage formel**. Ce langage formel
permet de décrire un autre langage et sa syntaxe. Le langage formel représente graossièrement l'alphabet d'un
**langage**. Ce **langage formel** fonctionne avec une **grammaire formelle** qui indique comment les symboles peuvent
s'assembler.

En théorie des langages il a été identifié que les **langages** avaient des propriétés différentes. Ces **langages**
sont classifiés par la [hiérarchie de Chomsky](https://fr.wikipedia.org/wiki/Hi%C3%A9rarchie_de_Chomsky):

<div class="table-wrapper" markdown="block">

| Grammaire | Langage | Automate |
| --- | --- | --- |
| Type-0 | récursivement énumérable | Machine de Turing |
| Type-1 | contextuel | Automate linéairement borné |
| Type-2 | algébrique | Automate à pile non déterministe |
| Type-3 | **rationnel** (**régulier**) | Automate fini |

</div>

Le tableau ci-dessus se lit de la façon suivante :

* Le Type-0 correspond aux langage les plus riches, aucune règles n'est imposée.
* Le Type-1 correspond aux langages avec plus de contraintes, notemment le langage est sensible au contexte.
* Le Type-2 correspond aux grammaires qui fonctionnent avec une pile, c'est à dire qu'ils supportent l'imbrication de symbole.
* Enfin le Type-3 correspond aux langages réguliers, ce sont les langages les plus contraints de cette hiérarchie.

Ce qui nous intéresse ici :

> Dans la théorie des langages formels les **expressions régulières** décrivent les **langages réguliers**.
> Elles ont la même pouvoir d'expression que les grammaires régulières.

C'est cette propriété qui est en fait utile pour identifier un _motif_ dans une chaine de caractère.

> **À noter** que puisque une expression régulière décrit un langage de Type-3, il n'est pas possible de décrire un langage
de type supérieur, car ces types ont moins de contraintes, qui ne peuvent pas être interprétée par une expression
régulière.
>
> HTML par exemple ne peut pas être **parsé** par une expression régulière car c'est un langage de Type-2, imbrication de
> symbole, ce qui explique par ex cette réponse sur [stackoverflow](http://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags).
> Attention cela ne veut pas dire qu'il n'est pas possible d'extraire du texte avec une regex en utilisant les balises
> HTML.

## Disclaimer

Aujourd'hui il existe donc plusieur moteurs avec des _règles_ différentes **POSIX**, **PCRE**, etc. Les implémentations
varient en fonction de la plateforme, PHP, Perl, Javascript, C#, Java. D'une manière générale le JDK bénéficie d'un moteur
basé sur celui de Perl (PCRE) qui fait partie de la dernière génération.

Dans le cadre de Java il s'agit de la fameuse classe `Pattern`. Cet article se concentre sur les fonctionnalité de
cette classe. Ceci étant dit certaines fonctionnalité auront le même comportement quelque soit l'écosystème.

> Vous remarquerez d'ailleurs que le moteur est nommé `Pattern` plutôt que Regex ou quelque chose du genre,
> l'explication est simple : cette génération de moteur est un peu plus riche que ce que permet une regex est
> permet de travailler sur **motif**, un **pattern**.

# Les différentes constructions

## Petit rappel

Je passe rapidement sur les bases, j'imagine que tout le monde connaît les **constructions** basiques d'une expression
régulière :

* Les classes de caractères `[ ]` et les compléments `[^ ]`
* L'opérateur de Kleene `*`
* L'alternative `|` (le pipe)
* Les autres quantificateurs : `+`, `?`, `{}`, ces quantificateurs ne sont vraiment que des raccourcis de ce qui est déjà
    exprimable avec les autres constructions, mais ils nous simplifient la vie.
* Les groupes `()`

Globalement pas de surprises ici, avec ses constructions il assez facile d'écrire l'expression la plus simple jusqu'à
l'expression un poil plus élaborée.

Par exemple pour valider un mail (sans rentrer dans les arcanes de la RFC) on peut avoir ça:

```java
@Test
public void simple_email_match() {
    String regex = "[a-z]+(\.[a-z]+)*@[a-z]+\.[a-z]{2,6}";

    assertTrue(Pattern.compile(regex).matcher("brice.dutheil@yopmail.com").matches());
}
```

Ok, c'est déjà pas mal, mais si on veut extraire une section d'un texte ou valider précisément certaines sections
d'un texte, il faut connaitre les constructions un peu plus pointues.

## Les ancres

Les ancres sont rangées dans la javadoc de la classe [`Pattern`](http://download.oracle.com/javase/1.5.0/docs/api/java/util/regex/Pattern.html)
sous la catégorie **Boundary matchers**. Une ancre identifie juste une position à laquelle elle matche,
**elle ne consomme pas** de caractères dans la séquence traitée.

### Le début et la fin d'une ligne

Généralement les personnes qui ont beaucoup travaillé avec le shell connaissent les deux principales ancres, à savoir
le début d'une ligne `^` et la fin d'une ligne `$`. Mais il y a une astuce en Java, c'est que par défaut `^` et `$`
repèrent le début et la fin du `CharSequence` uniquement, pas de notion de saut de ligne!

Pour s'en convaincre on écrit un petit test simple qu'on enrichira d'assertions, la méthode `regexFirstMatch` extrait
la première section du texte qui matche la regex :

```java
@Test
public void start_end_of_line__vs__permanent_start_end_of_string() {
    String text = "The account number is :\n" +
    "\t123456789\n" +
    "\tthe client phone number is :\n" +
    "\t0-987-654-321\n";

    assertEquals("T", regexFirstMatch(text, "^.")); // Début de la chaine de caractères
    assertEquals("1", regexFirstMatch(text, ".$")); // Fin de la chaine de caractères
}

private String regexFirstMatch(String text, String regex) {
    Matcher matcher = Pattern.compile(regex).matcher(text);
    return matcher.find() ? matcher.group(0) : "";
}
```

On ne s’attend pas à ça (matche `T` et `1`). Surtout quand la description de ces ancres utilise le mot **ligne**.
En fait par défaut le moteur considère une chaine de caractères comme une seule séquence et ignore le retour chariot.
Pour s'en sortir il faut activer l'option multiligne `Pattern.MULTILINE` dans le moteur, pour que celui-ci
identifie les sauts de ligne.

Ainsi dans le contexte du bout de code du dessus, les lignes suivantes permettent de voire qu'il s'agit bien du
caractère `:` de la première ligne qui est trouvé.

```java
Matcher matcher = Pattern.compile(".$", Pattern.MULTILINE).matcher(text);
matcher.find();
assertEquals(":", matcher.group(0));
```

Nice! mais il y a encore mieux, le moteur de regex de Java (comme certains autres) permet de donner les options à
l'intérieur de la regex, la javadoc de `Pattern` donne cette info dans la catégorie
**Special constructs (non-capturing)**, celle qui nous intéresse est la construction sur les options pour toute l'expression.

> `(?idmsux-idmsux)` Nothing, but turns match flags on - off

`m` est l'option multi-ligne, ce qui donne donc `(?m)` à placer au début de l'expression régulière :

```java
assertEquals(":", regexFirstMatch(text, "(?m).$"));
```

On choppe alors bien le caractère à la fin de la première ligne.

### Le début et la fin d'une séquence de caractères

Dans notre expression si on veut se caler dans tous les cas sur le début et la fin d'une séquence de caractères,
il y a des ancres dédiées `\A` et `\Z`. Celles-ci ne sont bien entendu pas affectées par l'option multiligne.

```java
assertEquals("T", regexFirstMatch(text, "\A.")); // Toujours le début de la séquence
assertEquals("1", regexFirstMatch(text, ".\Z")); // Toujours la fin de la séquence
assertEquals("1", regexFirstMatch(text, "(?m).\Z")); // Toujours la fin de la séquence
```

Notez quand même qu'en ce qui concerne le `\Z` le dernier caractère de la séquence qui est un séparateur de ligne `\n`
n'est pas le caractère qui matche! Comme indiqué dans la javadoc, cette ancre repère la position avant le dernier
**caractère séparateur** (écrit comme [_terminators_](http://download.oracle.com/javase/1.5.0/docs/api/java/util/regex/Pattern.html#lt)
dans la javadoc).

Il existe d'autres ancres, mais elles sont moins utiles, je vous laisse explorer par vous même.

## Les options

On a vu qu'on pouvait activer des options pour une expression régulière, effectivement c'est assez pratique.

Les options possibles utilisables à la construction ou dans le pattern sont dans la javadoc, mais les plus intéressantes sont :

<div class="table-wrapper" markdown="block">

| Option | Flag | Flag à la construction |
| --- | --- | --- |
| Multi-ligne | `m` | `Pattern.MULTILINE` |
| Insensibilité à la casse | `i` | `Pattern.CASE_INSENSITIVE` |
| Matching de la casse relatif aux règles Unicode | `u` | `Pattern.UNICODE_CASE` |
| Matching des caractère en fonction de leur forme canonique |  | `Pattern.CANON_EQ` |

</div>

Certaines options comme vu dans le tableau n'ont pas d'équivalence dans les options _en-ligne_ de la regex.

Exemple : parfois on aimerait bien s'assurer que la casse est **ou** n'est pas vérifiée sur
une portion de la regex. En utilisant la construction qui permet d'activer/désactiver une option
il est aussi possible de le faire dans **une portion de l'expression régulière**, notez la différence avec
`(?idmsux-idmsux)` :

> `(?idmsux-idmsux:X)` X, as a non-capturing group with the given flags on - off

C'est à peu près la même chose que pour les options avec une portée sur toute la regex, sauf que cette fois,
la portion soumise à l'option changée est à l'intérieur d'un **groupe**. Et là vous remarquerez que la javadoc dit
bien "*non-capturing*" ça veut dire que la regex ne gardera pas _en mémoire_ le contenu de ce groupe, contrairement
aux groupes qui sont donc *capturant* et sont identifiables par l'encadrement du groupe par des parenthèses simple
`(X)`.

Ainsi par exemple si on ne veut pas tenir compte de la casse dans une portion de la regex on écrirait:

```java
assertTrue(Pattern.compile("(?-i)[a-z]+ [a-z]+ [a-z]+")
                   .matcher("jqsdfkjkd fdfhJGJKGFQSDKjb ckbvg")
                   .matches()); // Fail
```

Cette expression ne marche pas, l'ensemble de l'expression est sensible à la casse ; l'option
`(?-i)` en début d'expression rends sensible à la casse. Pour autoriser les majuscules et les minuscule sur une seule
partie du texte il est possibe d'activer l'option sur le groupe du milieu `(?i:[a-z]+)` :

```java
assertTrue(Pattern.compile("(?-i)[a-z]+ (?i:[a-z]+) [a-z]+")
                  .matcher("jqsdfkjkd fdfhJGJKGFQSDKjb ckbvg")
                  .matches());
```

## Les bornes de mots

Les bornes de mots sont des ancres de type particulier. Comme n'importe quelle ancre, ces bornes ne consomment aucun
caractère. La borne `\b` s'utilise avant ou après un mot pour marquer le début ou la fin d'un mot.

Par exemple en utilisant la classe de caractère `\w`.

```java
assertTrue("word".matches("\\bword"));
assertTrue("word".matches("word\\b"));
assertTrue("word".matches("\\bword\\b"));
assertTrue("word".matches("\\b\\w+\\b"));

assertTrue("12dsk_".matches("\\b\\w+\\b"));

assertTrue("12dsk;  fdg987".matches("\\w+\\b.*\\b\\w+"));

assertFalse("12dsk;   ;:!,:".matches("\\w+\b.*\\b\\w+"));

assertTrue(Pattern.compile("\\bes\\b").matcher("Tu es encore dans ces histoires ").find());
assertFalse(Pattern.compile("\\bes\\b").matcher("Tu as encore des histoires ").find());
```

Effectivement `\b` marque la différence entre une classe de caractère de type lettre par rapport aux classes adjacentes.
On remarque néanmoins que s'il n'y a donc pas de classes de type caractère avant ou après, la borne fait sauter
l'expression. De la même manière la borne ne fonctionne pas avec une classe de caractère composée de caractères qui sont
considérés comme ne faisant pas partie des mots (exemple en ajoutant le tiret à la classe suivante : `[0-9a-z-]`).

```java
assertFalse("12dsk-".matches("\\w+"));

assertFalse("12dsk-".matches("\\w+-\\b"));
assertTrue("12dsk-".matches("[0-9a-z-]+"));
assertFalse("12dsk-".matches("[0-9a-z-]+\\b"));

assertFalse("12dsk. ".matches("\\w+.\\b."));
```

Évidemment aussi, mettre une borne dans une regex au milieu de caractères ne marchera pas.

```java
assertFalse("bobEtLéa".matches("bob\\b\\w+\\bLéa"));
```

Le complément d'une borne `\b` est représenté par la borne `\B`, celle-ci matche tout ce que `\b` ne matche pas.
Dans les faits `\B` est la borne entre deux classes de caractères distinctes tant que celles-ci ne contiennent pas
de caractères appartenant à `\w`.

```java
assertTrue("12dsk-".matches("\\w+-\\B")); // B capture l'inverse b
assertTrue("12dsk.".matches("\\w+\\.\\B"));
assertFalse(".!?nt".matches("[.!?]+\\Bnt")); // B ne fonctionne pas avec des caractères appartenant à \w
assertTrue(".!? nt".matches("[.!?]+\\B\\s+nt"));
assertTrue(".!?,,,;:".matches("[.!?]+\\B[,;:]+"));
```

## Utiliser une borne de mot accentué

Si je veux matcher un texte en allemand, du grec ou simplement des lettres accentuées de notre bon français ?
Là ça pèche un peu si on utilise le `\w`.

```java
assertFalse("Éole".matches("\\b\\w+"));
assertTrue("Éole".matches("\\bÉole"));

assertTrue("Éole".matches("\\b[Éa-z]+"));
assertTrue("Éole".matches("\\b\\p{L}+"));
```

En effet la classe `\w` ne connait que les caractères ASCII et plus précisément; uniquement ceux de cette classe
`[a-zA-Z0-9_]` tel que c'est mentionné dans la javadoc. Pour palier à cette limitation soit il faut ajouter le
caractère accentué à une classe de caractère, soit on utilise une **classe de caractère Unicode**, c'est ce qui est
fait dans la dernière assertion de l'exemple ci-dessus `\p{L}`.

Je reviendrais plus tard sur Unicode avec les expressions régulières.

> **Attention à l'encodage** de vos codes source ! J'ai eu des erreurs d'encodage du fichier sur Eclipse, IntelliJ et
NetBeans qui provenaient de plateformes différentes (MacOSX et Windows), du coup le caractère `É` n'était pas bien
encodé (comprendre que l'IDE encodait ce caractère dans autre chose qu'une lettre), ce qui faisait évidement échouer
l'expression.


# Fin de la partie 1

Voilà pour la première partie, la plus simple, sur les expressions régulières en Java. Pour la suite qui arrive très
bientôt j'exposerai la manière de fonctionner de certaines constructions un peu particulières :  les backreferences,
les quantificateurs possessifs, les possibilités de lookahead / lookbehind.

## Références

* [http://en.wikipedia.org/wiki/Regular_expression](http://en.wikipedia.org/wiki/Regular_expression)
* [http://download.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html](http://download.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html)
* [http://perldoc.perl.org/perlretut.html](http://perldoc.perl.org/perlretut.html)
