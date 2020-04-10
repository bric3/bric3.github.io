---
authors: ["brice.dutheil"]
date: "2010-10-15T14:40:15Z"
disqus_identifier: 211 http://dutheil.brice.online.fr/blog/?p=211
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
- pattern
- regex
- regexp
- regular expression
- backreference
slug: sexprimer-regulierement-partie-2
title: Expressions régulières (Partie 2)
type: post
---
La première partie de cette mini-série s'est focalisée sur une petite intro, je n'ai pas vraiment insisté sur
les bases des expressions régulières, j'ai juste abordé les ancres et les options, et j'ai parlé de certaines astuces
à connaître. La suite de cette série continue comme prévu sur les constructions suivantes :


* Les groupes qui ne capturent pas (*non-capturing group*)
* Les backreferences
* Les autres quantificateurs
    * Les quantificateurs gourmands (dits *greedy quantifiers*)
    * Les quantificateurs paresseux (dits *lazy quantifiers* ou comme le dit la javadoc de `Pattern` *reluctant quantifiers*)
    * Les quantificateurs possessifs (dits *possessive quantifiers*)


# Le backtracking

Certaines des constructions présentées ici démontrent que le moteur de regex de java fait partie des toutes
dernières générations. Afin de mieux expliquer la manière de fonctionner des quantificateurs, je vais faire un tour
sur la technique de backtracking du moteur de regex, feature essentiel pour faire fonctionner ces constructions.

Et aussi pourquoi certaines expressions régulières sont risquées en ce qui concerne les performances.

Mais d'abord concentration sur les groupes, structure de base pour construire des expressions régulières plus pointues.

# Les groupes

## Les groupes capturant

Vous connaissez certainement déjà ces groupes, par exemple :

```java
public class Groups {
    private static final String mail = "brice [dot] dutheil [at] yopmail [dot] com";

    @Test
    public void grouping() {
        Matcher matcher = Pattern.compile("([a-z]+) ( ?\\[[a-z]+\\] ([a-z]+))+").matcher(mail);
        matcher.find();

        assertEquals("brice", matcher.group(1));
    }
}
```

Dans l'expression ci-dessus, il y a trois groupes définis dans l'expression rationnelle.

* {{< c highlight-red >}}`([a-z]+)`{{< /c >}}` ( ?\[[a-z]+\] ([a-z]+))+`
    qui est donc le **groupe 1**
* `([a-z]+) `{{< c highlight-red >}}`( ?\[[a-z]+\] ([a-z]+))`{{< /c >}}`+`
    qui est le **groupe 2**
* `([a-z]+) ( ?\[[a-z]+\] `{{< c highlight-red >}}`([a-z]+)`{{< /c >}}`)+`
    enfin qui est le **groupe 3** il est défini à l'intérieur du groupe 2

Le moteur de l'expression régulière enregistre juste la référence du groupe, et lorsque qu'il y a récursion sur
les groupes, le groupe prend la valeur du dernier contenu matché. Ainsi dans cet exemple après un premier appel à
`find()`, l'ensemble de la chaîne de caractère a été consommée, il est alors possible de récupérer les groupes 2 et 3
en faisant appel à `group()` :

```java
assertEquals("[dot] com", matcher.group(2));
assertEquals("com", matcher.group(3));
```

En plus de ça, les références aux groupes sont limitées à 10. C'est rare d'avoir besoin de plus de
10 groupes, si c'est le cas il faudra peut-être revoir l'algorythme d'extraction de donnée.
Par exemple splitter la chaîne ou la regex.

Cependant on peut en partie s'arranger pour que les groupes qui ne nous intéressent pas ne soit pas référencés, il faut
utiliser un groupe on-capturant.

## Les groups non-capturant (non-capturing groups)

C'est presque à la fin de la javadoc de la classe `Pattern`. Ils se construisent de la manière suivante :

```java
(?:regex)
```

`?:` indique que ce groupe n'est pas capturant.

Pour reprendre l'exemple plus haut, le groupe 2 n'est pas vraiment utile à notre expression régulière. Du coup
on pourrait écrire :

```java
@Test
public void groupingNonCapturing() {
  Matcher matcher = Pattern.compile("([a-z]+) (?:[ ]?\\[[a-z]+\\] ([a-z]+))+").matcher(mail);
  matcher.find();

  assertEquals("brice", matcher.group(1));
  assertEquals("com", matcher.group(2));
}
```

Il n'y a alors 2 groupes uniquement qui sont enregistré et référencé.


# Les références arrière (backreferences)

Une **référence arrière**, fait référence à un groupe qui a déjà été identifié et donc référencé. Typiquement
on pourra utiliser ces références arrière pour matcher exactement la même chaine que celle matchée par le groupe.

Ce type de construtions fait partie des avancées sur les moteurs de dernière génération.

```
\X
```

Ou X est le numéro du groupe, sa référence. Par exemple le cas le plus simple :

```java
assertTrue(Pattern.compile("([0-9]+) \\1")
                  .matcher("123 123")
                  .matches()); // 123 matche le groupe 1 (123)

assertFalse(Pattern.compile("([0-9]+) \\1")
                   .matcher("987 9876")
                   .matches()); // 9876 ne matche pas exactement le groupe 1 (987)
```

Première assertion; le groupe 1 matche `123`, la backreference va chercher à matcher le contenu exacte qui a
été matché par le groupe 1, donc `123`. La deuxième assertion montre bien que la backreference ne matchera pas `9876`,
car le moteur s'attend au même contenu que `987`.
Enfin notez quand même l'utilisation de l'appel `matches()` plutôt que `find()`.

Bien entendu il faut que ce soit un groupe capturant, sinon la backreference ne sait pas ou chercher sa valeur.
L'exemple qui suit montre un `Pattern` qui compile, mais qui ne fonctionnera pas:

```java
assertTrue(Pattern.compile("(?:[0-9]+) \\1").matcher("123 123").matches()); // fail
```

Le simple fait que ce pattern compile m'étonne, j'aurais plutôt choisi une approche *fail-fast* dans ce cas, c'est peut-être un oubli.

Ce genre de construction est assez pratique si on veut vérifier un élément d'un langage comme le XML. (Pas de le parser !)

```java
assertTrue(Pattern.compile("<([a-z]+)>.*</\\1>").matcher("**dude!**").matches()); // fail
assertTrue(Pattern.compile("<([a-z]+)[^>]*>.*</\\1>").matcher("<strong style=\"\">dude!</strong>").matches()); // ok
assertTrue(Pattern.compile("<([a-z]+)[^>]*>.*</\\1>").matcher("**dude!**").matches()); // fail
```


Attention il peut y avoir des astuces, en particulier sur le groupe qui fait le premier match. Par exemple dans
le suivant on va voir le moteur regex valider l'expression, alors que la chaîne à valider n'est pas correcte :

```java
assertTrue(Pattern.compile("<([a-z]+)[^>]*>.*!</\\1>")
                  .matcher("<strong>dude!</s>")
                  .matches()); // ok, wait what!
```


Effectivement `<strong></s>` n'est pas correct syntaxiquement pour du XML pourtant le moteur valide la séquence de
caractère. La raison derrière c'est qu'il y a le mécanisme de **backtracking** très puissant du moteur de regex.
Avant d'appronfondir sur le *backtracking*, il faut se rendre compte que le moteur matche correctement dans ce cas,
voilà ce qu'il se passe :

1. Le moteur trouve `strong` pour le *groupe 1*,
2. mais lorsqu'il essaye de matcher la backreference avec `strong`,
3. il n'y arrive pas donc il _reviens en arrière_ pour tenter d'autres combinaisons qui marche
4. Le moteur essaie jusqu'à trouver cette combinaison :

    le *groupe 1* a pour valeur `s`, ce qui permet à la backreference de matcher.
    Le reste du texte `trong` est alors matchée par cette partie de l'expression `[^>]*`.

La solution, est d'utiliser une borne de mot (vu dans la partie 1 de cette petite série d'article).

```java
assertFalse(Pattern.compile("<([a-z]+\\b)[^>]>.*</\\1>")
                   .matcher("<strong>dude!</s>")
                   .matches());
```

De cette façon le *groupe 1* `([a-z]+\b)` est littéralement obligé d'être suivi par autre chose qu'un caractère
de mot (classe `\w`). Avec cette expression la balise fermante ne peut plus être matché par la backreference.

Utilisation sympa des backreferences est de chercher dans un texte les mots répétés dans un texte :

```java
assertTrue(Pattern.compile("\\b(\\w+)\\s+\\1\\b").matcher("the the is repeated").find());
```

# Les quantificateurs

Les quantificateurs permettent comme leur nom l'indique de quantifier (une expression). À l'exception de
l'opérateur de Kleene, géré par les moteurs de regex depuis très longtemps, tous les autres quantificateurs
sont des représentations simplifiées de ce qui est exprimable par des constructions basiques.

* `dady?` Le quantificateur optionnel peut s'exprimer par une alternative (attention à l'ordre) : `dady|dad`
* `(?:pa){1,3}` Le quantificateur borné peut s'exprimer en répétant les termes et/ou avec une alternative : `pa|papa|papapa`
* `vrou+m` Le quantificateur 1 ou plus peut être remplacé par l’occurrence 1 puis par une construction avec l'opérateur de Kleene : `vrouu*m`

Bref ces notations simplifiées sont bien pratiques.

## Les quantificateurs gourmands (greedy quantifiers)

Pas de surprise ces quantificateurs font partie de la catégorie des quantificateurs dit gourmands. Vous savez
certainement déjà les utiliser, cependant il peut y avoir des cas qui peuvent poser problèmes.

Dans l'exemple suivant je voudrais chopper la balise ouvrante.

```java
public class Quantifiers {
    @Test
    public void greedy() {
        assertEquals("<h1>wont match</h1>", regexFirstMatch("<h1>wont match</h1>", "<.+>")); // greediness busted
        assertEquals("<h1>", regexFirstMatch("<h1>wont match</h1>", "<.+?>"));
    }

    private String regexFirstMatch(String text, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(text);

        return matcher.find() ? matcher.group(0) : "didnt found match";
    }
}
```

Dans la première approche on utilise un quantificateur gourmand `<.+>` ce qui veut dire que le moteur va essayer de
consommer au maximum la séquence de caractères.


1. Pour la section `.+` de la regex, le quantificateur va essayer de valider au maximum le `.`
    * Du coup le premier caractère `>` est validé par la construction `.`,
    * Puis le deuxième (le dernier caractère) `>` est également validé par `.`.

2. Après ce dernier `>` dans la séquence de caractère la chaîne complète est consommée, mais il reste le dernier `>` **dans l'expression rationnelle**.
3. Du coup le moteur utilise le mécanisme de backtracking pour revenir en arrière, il tombe alors sur le `1` de `</h1>`.
4. Finalement le `>` de l'expression matche le `>` de la séquence de caractère.

Comme ce n'est pas ce qu'on veut récupérer, la balise ouvrante, une solution serait donc de prendre un
**quantificateur paresseux** identifiable par le point d’interrogation qui suit le quantificateur.

Question performance dans le cas présent, il est plus intéressant de ne pas utiliser le point `.` avec un
quantificateur paresseux mais plutôt d'utiliser un complément de l'ensemble qu'on ne veut pas matcher, c'est à dire
une classe de caractère avec exclusion du caractère non voulu `>`.

```java
assertEquals("<h1>", regexFirstMatch("<h1>wont match</h1>", "<[^>]+>"));
```

## Les quantificateurs paressseux (lazy quantifiers)

Ces quantificateurs sont bien nommés parce dans le genre, ils vont en faire vraiment le moins possible. Pour les comparer
donc avec un quantificateur gourmand ou la séquence maximum est consommée (notez que la méthode **regexFirstMatch** est
    la même que dans le bout de code ci-dessus) :

```java
assertEquals("abc1abc2", regexFirstMatch("abc1abc2", "abc1(?:abc\\d)?"));
```

Le quantificateur `?` essaye de matcher la regex du groupe, et il y arrive, donc la séquence complète est consommée.
Par contre ci la regex utilise une construction avec un quantificateur paresseux `??` :

```java
assertEquals("abc1", regexFirstMatch("abc1abc2", "abc1(?:abc\\d)??"));
```

Alors le quantificateur ne va pas s'emmerder à matcher, si la regex matche déjà ce qui est fait par la première partie
de la regex `abc1`. Ce qu'il faut retenir c'est qu'un lazy quantifier, ne matchera jamais si le moteur valide déjà
l'expression, et le corollaire est que le lazy quantifer cherchera toujours à matcher si et uniquement si la regex
n'a pas déjà été validée.

Autre exemple avec un quantificateur borné :

```java
assertEquals("abc1abc2abc3", regexFirstMatch("abc1abc2abc3", "(?:abc\\d){2,3}")); // greediness busted
assertEquals("abc1abc2", regexFirstMatch("abc1abc2abc3", "(?:abc\\d){2,3}?")); // lazyness
assertEquals("didnt found match", regexFirstMatch("abc1", "(?:abc\\d){2,3}?"));
```

À la ligne 2, le quantificateur paresseux est obligé d'être exécuté une fois au moins pour matcher, mais il en fait
le moins possible.

## Les quantificateurs possessifs (possessive quantifiers)

Les quantificateurs gourmands et paresseux, utilisent intelligement la capacité de backtracking afin d'évaluer
les permutations possible qui permettent de valider l'expression régulière suivant leur stratégies respectives
(*en faire le plus* ou *en faire le moins*). Cette propriété permet d'avoir des expressions assez souples pour
matcher un grand nombre de séquence de caractère.

Cependant **cette souplesse a un coût, le backtracking a un coût en mémoire et en temps CPU**. Ce coût monte suivant
la complexité de l'expression rationnelle et en fonction de la séquence de caractère. Pour des raisons de performance
les créateurs des moteurs de regex ont introduit une nouvelle construction qui améliore les performances de votre
regex : les quantificateurs possessifs.

Cette catégorie de quantificateur est un peu différente des deux autres, dans la mesure ou le
**backtracking est désactivé**. Ce qui veut dire, si vous avez suivi, que l'expression régulière ne peut pas revenir
en arrière chercher une précédente position ou la regex validait. Cependant il faut noter qu'un possessive quantifier
cherche également à matcher le plus possible.

Typiquement dans le code suivant :

```java
assertEquals("<h1>will match</h1>", regexFirstMatch("<h1>will match</h1>&nbsp;", "<.+>"));
```

La partie de l'expression régulière `.+` va tout matcher jusqu'au point virgule `;` de `&nbsp;`. Seulement comme expliqué
plus haut, une fois que la String est consommée, le caractère `>` dans la regex ne peut pas matcher, donc le moteur
reviens plusieurs fois sur ses pas, puis ressaye de matcher le `>` de la regex. Ce comportement peut être désiré
dans certains cas, mais parfois si on souhaite juste rechercher quelque chose de spécifique ou valider très vite
un texte sans chercher d'autres combinaisons alors ce n'est pas l'idéal.

```java
assertEquals("didnt found match", regexFirstMatch("<h1>will match</h1>&nbsp;", "<.++>"));
```

Ici l'expression est constituée d'un possessive quantifier, et en effet l'expression ne matche pas parce
qu’une fois que la regex a consommée l'ensemble de la chaîne, et qu'elle ne peut plus matcher le dernier `>`,
elle se déclare en erreur. On peut voir ça comme une construction du genre *fail-fast*.

L'intérêt véritable des constructions de cette catégorie est intéressante uniquement si les **sections adjacentes
de la regex sont mutuellement exclusives**. L'exemple le plus prégnant est lorsqu'on utilise un complément
avec un quantificateur possessif :

```java
assertFalse(Pattern.compile("<[^>]++>").matcher("<property attr1=\"blah\" ....>>").matches());
```

Ici le complément `[^>]` est naturellement mutuellement exclusif avec le caractère `>`, ce qui permet à la regex
d'invalider très vite la séquence de caractères (notez la fin de la chaîne `>>`). Si on avait utilisé un greedy
quantifier, alors le moteur serait revenu en arrière autant de fois que possible pour tenter de valider l'expression,
ce qui est impossible avec la séquence passée en paramètre.

Exemple à ne pas faire, car les tokens ne sont pas mutuellement exclusifs ; `a*+` immédiatement suivi d'un `a`,
du coup la regex ne peut pas matcher car `a*+` consomme tous les `a` :

```java
assertFalse(Pattern.matches("\\ba*+ab\\b", "aaaaaaab"));
```

Les quantificateurs possessifs sont des constructions qui sont supportées par les dernières générations de moteur
de regex, parce qu'ils sont en réalité des groupes spéciaux. En effet dans la Javadoc de la classe
[Pattern](http://download.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html), on trouve à la fin une partie
sur les constructions spéciales, et celle qui nous intéresse dans ce cas, c'est celle là :


> `(?>X)` X, as an **independent, non-capturing group**

1. *"non capturing"* : Simplement parce que le groupe ne fait pas de capture lorsque X matche.
2. *"independant"* : Ici ce n'est pas très clair dans la javadoc de Pattern, pour trouver la signification
    il faut se rendre sur la [documentation des regex en Perl](http://perldoc.perl.org/perlretut.html), on y apprend
    qu'il s'agit d'un groupe indépendant du reste de l'expression régulière, que ce groupe ne sait pas revenir
    en arrière (pas de backtracking), en gros le moteur de regex permet à ce groupe de consommer tout ce qu'il peut
    sans considérer les autres parties de la regex.

Une petite vérification :

```java
assertTrue(Pattern.matches("\\ba*+b\\b", "aaaaaaab"));
assertFalse(Pattern.matches("\\ba*+b\\b", "aaaaaaa"));

assertTrue(Pattern.matches("\\b(?>a*)b\\b", "aaaaaaab"));
assertFalse(Pattern.matches("\\b(?>a*)b\\b", "aaaaaaa"));
```

Donc un quantificateur possessif est une notation simplifiée d'un groupe indépendant et non capturant!

# Le backtracking

Comme vous le savez, je l'ai bien répété, le backtracking c'est ce qui permet au moteur de regex de traquer
les constructions qui ont validé. Le backtracking n'a de sens que pour les quantificateurs, en effet ce sont
les quantificateurs qui vont essayer de tester une construction un certain nombre de fois. Cela dit cette
construction peut-être suvi par une autre et le moteur doit s'assurer que les constructions qui suivent
le quantificateur valident également le reste de la séquence.

## Prenons un exemple :

Dans le cas suivant on le pattern, observez le fait que le point `.` n'est pas mutuellement exclusif avec `bob`.

```
ab.*bob
```

Et on essaye de valider la chaine de caractères, les chiffres sont là pour illustrer la partie sur la quelle
la construction `.*` devrait matcher, mais des lettres auraient pu faire l'affaire.

```
ab1234bob
```

A la première étape `Pattern.compile`, l'expression va être transformée dans un arbre. Techniquement le code
ressemble à la fois au pattern *Chain of Responsability* et au pattern *Composite* (pour les groupes ou pour les
quantificateurs notamment). Le moteur ajoute ses propres nœud au début et à la fin de l'arbre pour travailler avec
cette représentation.

Dans le diagramme suivant chaque cadre correspond à l'état de la consommation de la séquence de caractère et à
celui de l'expression régulière ainsi découpée en nœuds.

![backtracking](/assets/backtracking.png)

On comprend immédiatement le problèmes potentiels sur des expressions qui utilisent énormément les quantificateurs non-possessifs :

1. Plus la partie à matchée est longue pour le quantificateur, plus la mémoire sera consommée.
2. Si les constructions qui suivent ne matchent pas, celles-ci devront être annulée et réessayée, ce qui veut dire un temps d’exécution plus long!

La solution c'est de faire attention quand on construit une expression rationnelle. En particulier si elle est critique,
l'idée serait de la benchmarquée, mais bon il faut pas tomber non plus dans ce qu'on appelle **Premature Optimisation**.

# Bilan

Le backtracking c'est bien ; c'est ce qui permet à la regex d'être souple, mais clairement il faut faire attention à
ce mécanisme. Il sera intéressant du coup d'utiliser des groupes non-capturants et indépendants si l'opportunité le permet.

Cette série s'achèvera par une troisième et dernière partie ou j'aborderaie les possibilité de travailler avec Unicode,
et surtout comment indiquer dans une regex qu'on ne veut pas d'une construction complète.


# Références

* [http://download.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html](http://download.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html)
* [http://perldoc.perl.org/perlretut.html](http://perldoc.perl.org/perlretut.html)
