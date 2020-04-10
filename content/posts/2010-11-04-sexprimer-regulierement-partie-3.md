---
authors: ["brice.dutheil"]
date: "2010-11-04T19:55:50Z"
disqus_identifier: 228 http://dutheil.brice.online.fr/blog/?p=228
meta:
  _edit_last: "1"
  _su_description: Expression régulière en Java, look behind, look ahead et unicode
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
- unicode
slug: sexprimer-regulierement-partie-3
title: Expressions régulières (Partie 3)
type: post
---
Dans cette troisième et dernière partie sur les expressions régulières en Java. Je vais aborder deux thèmes assez
peu utilisés et pourtant très utiles.

* Le premier, dans la continuité des groupes ce sont les constructions de **look behind** et **look ahead**.
* Le deuxième point abordera le support de Unicode dans nos expressions régulières.

# Constructions de _regard_ autour (look around)

C'est bien de ça dont il s'agit; ce feature, introduit grâce aux groupes non-capturant, permet de vérifier si une
autre expression matche avant ou après une expression capturante **sans consommer** de caractères.
Il y a 4 constructions de ce type :

* Les expressions pour regarder devant (look ahead)
    1. `(?=X)` X, via zero-width **positive lookahead*** : L'expression cherche à matcher X **après** la position
        courante et sans consommer.
    2. `(?!X)` X, via zero-width **negative lookahead*** : L'expression cherche à **ne pas** matcher X **après**
        la position courante et sans consommer.
* Les expressions pour regarder derrière (look behind)
    1. `(?<=X)` X, via zero-width **positive lookbehind*** : L'expression cherche à matcher X **avant**
        la position courante et sans consommer, ou X est une expression régulière de **longueur connue**.
    2. `(?<!X)` X, via zero-width **negative lookbehind*** : L'expression cherche à **ne pas** matcher X **avant**
        la position courante et sans consommer, ou X est une expression régulière de **longueur connue**.

Ces assertions ressemblent aux bornes `\b` elles ont un fonctionnement similaire mais plus complexes. Passons aux
tests pour voir leur fonctionnement.

## Les groupes de look ahead

Par exemple avec le look ahead positif :

```java
public class LookAheadLookBehind {

    private String text = "static private String aStaticVarLabel;" +
            "static private Long anotherStaticVarLabel;" +
            "private String anInstanceVar;" +
            "protected String anInteger;";

    @Test
    public void classicRegex() {
        assertEquals("aStaticVarLabel", regexMatch(text, "\w+Label"));
    }

    @Test
    public void positiveLookAhead() {
        assertEquals("aStaticVar", regexMatch(text, "\w+(?=Label)"));
    }

    private String regexMatch(String text, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(text);

        return matcher.find() ? matcher.group(0) : "";
    }
}
```

Ligne 10, on veut chopper les lignes qui se terminent par `Label` avec une expression usuelle. Si on ne voulais pas
la partie `Label`, alors il aurait fallu créer un autre groupe autour de `\w+`, cependant le curseur aura consommé
les caractères. L'alternative est d'utiliser un look ahead positif, c'est ce qu'on a à la ligne 15, ici le curseur
s'arrête après le `r` juste avant `Label`.

Notez que dans l'exemple ce qui est retourné est le **groupe 0** (ligne 21), c'est à dire l’ensemble de ce qui est
capturé par toute la regex. Ceci illustre à nouveau que les groupes de look ahead/begind ne capturent pas
(méthode positiveLookAhead, ligne 15). C'est assez pratique pour faire des sélections ou des remplacements,
dans Eclipse ou IntelliJ par exemple.

Si typiquement on cherche des termes qui ne se terminent pas par `Label`. On écrira simplement :

```java
@Test
public void negativeLookAhead() {
    assertEquals("static",
                 regexMatch(text, "\w+(?!Label)")); // retourne 'static' car ce mot ne se termine pas par 'Label'
}
```

L'expression chope en premier `static`, tout simplement parce que cette partie du texte matche le fait
qu'il n'y a pas `Label` qui suit, si on veut chopper le nom d'une variable alors on peut ajouter des constructions
de **look behind**. C'est ce qu'on regarde juste après.

Faisons d'autres tests :

```java
@Test
public void more_negativeLookAhead() {
    assertTrue(Pattern.compile("\w+(?!Label)")
                      .matcher("aStaticVar")
                      .matches()); // match car Label n’apparaît pas dans la chaîne

    assertTrue(Pattern.compile("\w+(?!Label)")
                      .matcher("aStaticVarLabel")
                      .matches()); // comme '\w+' est est quantificateur greedy,
                                   // il va matcher 'aStaticVarLabel', ce qui rend le
                                   // lookahead négatif '(?!Label)' vrai aussi
    assertFalse(Pattern.compile("(?!\w+Label)")
                       .matcher("aStaticVarLabel")
                       .matches()); // Ne matche pas car la construction de lookahead
                                    // contient le quantificateur '\w+'
}
```

À la ligne 5 attention, comme il y a devant un quantificateur gourmand `\w+` et en dehors de la construction
lookahead, celui-ci va avaler la chaîne complète `aStaticVarLabel` et comme tous les caractères auront été
consommés le lookahead négatif `(?!Label)` sera également valide. La ligne 6 corrige ça en incluant la
construction `w+` à l'intérieur du lookahead.

## Les groupes de look behind

```java
@Test
public void positiveLookBehind() {
    assertEquals("anotherStaticVarLabel", regexMatch(text, "(?<=private Long )\w+"));
}
```

Donc là j'ai préfixé la regex par ce que je voulais voir juste avant. De la même manière si on ne veut pas
d'un terme, on utilisera un **look behind** négatif `(?<!)`, par exmple si on ne veut pas de `String`.

```java
@Test
public void negativeLookBehind() {
    assertEquals("anotherStaticVarLabel", regexMatch(text, "(?<=private \w{4,8} )(?<!String )\w+"));
}
```

Observez ici qu'il y a deux constructions adjacentes look behind, l'une positive l'autre négative, ce qui
illustre encore mieux que ces constructions ne consomment pas la séquence de caractères.

Observez également que l'expression ici est de longueur connue : le `\w{4,8}` ne prend que de 4 à 8 caractères.
Il n'est pas possible d'écrire un look behind avec un quantificateur où la longueur n'est pas connue, la
**construction suivante est fausse** et provoquera une erreur de syntaxe : `(?<!private \w+ )`.
C'est une limite technique qui impose aux groupes de look behind d'avoir une longueur fixe ou calculable;
les quantificateurs bornés `{n,m}`, l'option `?` ou l'alternative `|` tombent dans cette catégorie.
Ainsi on pourrait écrire :

```java
@Test
public void revised_negativeLookBehind() {
    assertEquals("anotherStaticVarLabel", regexMatch(text, "(?<=(?:static )?private (?:long|Long) )\w+"));
}
```

Et donc par opposition les quantificateurs `*` et `+` ne sont pas autorisés dans les lookbehind.

## Attention aux quantificateurs sur une même classe de caractère

Bon, il existe certains cas un peu délicats ou les caractères adjacents d'une séquence font partie de
la même classe. Dans le bout de texte utilisé dans le premier exemple, les noms variables correspondent typiquement
à ça: <code><span class="hljs-string">anotherStaticVar</span><span class="hljs-keyword">Label</span></code>

Le nom de la variable appartient à la classe de caractère `[a-zA-Z0-9_]` ou encore à `\w`.


Lorsqu'on faisait un **positive look ahead**, le quantificateur `\w+` va chercher à matcher l’ensemble des caractères
de cette classe, ce qui veut dire que `\w+` va **matcher et consommer** les caractères `anotherStaticVarLabel`.
Du coup lorsque la construction `(?=Label)` cherche à matcher `Label`, elle n'y arrive pas. Ce n'est pas grave,
avec le backtracking l'expression `\w+` reviens en arrière jusqu'à ce que `(?=Label)` matche.

L'histoire est différente avec un **negative look ahead**; une fois que la partie `\w+` a matché
`anotherStaticVarLabel`, le curseur est positionné après le `l`. Maintenant le moteur teste `(?!Label)`, qui cherche
donc à ne pas matcher `Label`, normal c'est une négation. Et là ça marche, cette partie de l'expression ne peut plus
trouver `Label`, donc la construction est validée.

Bref ce n'est pas ce qu'on veut, nous voulons par exemple identifier les variables qui ne sont pas
suffixées par `Label` !

Pour ne éviter ce problème, il faut placer le groupe look ahead négatif avant `\w+`. Cela ne posera pas de
problème étant donné que les look ahead ne consomment pas la séquence de caractères. Ainsi en écrivant :

```java
@Test
public void controlYourQuantifiers() throws Exception {
    assertEquals("anInstanceVar", regexMatch(text, "(?<=String )(?!\w+Label)\w+"));
}
```

La première partie est un look behind pour avoir ce qui est après `String `, le deuxième groupe est le look ahead
dont je parlais, ce groupe cherche à ne matcher `\w+Label`, si les derniers caractères `Label` de la regex ne sont
pas trouvés alors c'est bon. Finalement l'expression se termine par `\w+`. L'astuce donc se fait en deux étapes:


1. Déplacer le look ahead avant l'expression qui consomme les caractères et qu'on veut capturer, ici `\w+`
2. Faire précéder dans le look ahead négatif l'expression qu'on veut capturer, ici le groupe est devenu `(?!\w+Label)`, 
    grâce au backtracking dans ce groupe une valeur `aStaticVarLabel` ne sera pas matchée (negative look ahead).

Voilà pour les possibilités de look ahead et de look behind dans les expressions rationnelles.

# Unicode

En quoi Unicode est intéressant dans nos regex en Java?

1. Unicode est supporté nativement par Java, le format interne des String est Unicode.
2. Unicode nous apporte des classes, des catégories ou des propriétés de caractères bien plus étendues que les classes
    ASCII couramment utilisées.

## Example avec un seul caractère Unicode

Par exemple, j'ai une application US qui vérifie que le texte entré est uniquement composé de lettres. Facile avec
la regex suivante:

```
[a-zA-Z]
```

Maintenant je me dit que je souhaiterais avoir des clients français! Aille! L'approche facile mais peu élégante
est d'écrire une regex dans ce genre :

```
[a-zA-Zéèêïôàù]
```
Et encore j'oublie les accents sur les majuscules et encore d'autre caractères spéciaux, alors qu'ils ont pourtant 
[pleine valeur orthographique sur les majuscules également](http://www.academie-francaise.fr/langue/questions.html#accentuation).
S'il fallait en plus gérer le grec, l’allemand, l’espagnol, nous aurions du mal avec une telle expression régulière.
Et le raccourci `w` n'aide pas vraiment non plus! C'est là que viennent les classes de caractère Unicode, pour
identifier un caractère qui est une lettre, on écrira très simplement :

```
\p{L}
```

Ainsi en Java on aura par exemple

```java
assertTrue(Pattern.matches("(\\p{L}| )+",
                           "une manœuvre sur un chêne"));
assertFalse(Pattern.matches("[\\p{Lower} ]+",
                            "une manœuvre sur un chêne")); // p{Lower} est une classe POSIX / ASCII
assertTrue(Pattern.matches("[\\p{Ll} ]+",
                           "une manœuvre sur un chêne")); // Classe des petites lettres en Unicode p{Ll}

assertTrue(Pattern.matches("[\\p{L} ]+",
                           "eine kleine Straße in München"));

assertTrue(Pattern.matches("[\\p{L} ]+",
                           "Это настоящая красота"));
```

IntelliJ est très bien, il fourni l'auto-complétion dans les regex c'est assez pratique à l'intérieur du code,
mais pas d'explication sur la signification de ces blocs de caractères Unicode. Eclipse n'en parlons pas, et
NetBeans je ne sais pas. En tous cas on trouve une réponse [là](http://www.unicode.org/Public/5.1.0/ucd/UCD.html)
à propos des blocs Unicode:

{{< wrapTable >}}

{:.alternate}
| Abréviation reconnue par `Pattern` | Signification |
| --- | --- |
| L | Letter |
| Lu | Uppercase Letter |
| Ll | Lowercase Letter |
| Lt | Titlecase Letter |
| Lm | Modifier Letter |
| Lo | Other Letter |
| M | Mark |
| Mn | Non-Spacing Mark |
| Mc | Spacing Combining Mark |
| Me | Enclosing Mark |
| N | Number |
| Nd | Decimal Digit Number |
| Nl | Letter Number |
| No | Other Number |
| S | Symbol |
| Sm | Math Symbol |
| Sc | Currency Symbol |
| Sk | Modifier Symbol |
| So | Other Symbol |
| P | Punctuation |
| Pc | Connector Punctuation |
| Pd | Dash Punctuation |
| Ps | Open Punctuation |
| Pe | Close Punctuation |
| Pi | Initial Punctuation |
| Pf | Final Punctuation |
| Po | Other Punctuation |
| Z | Separator |
| Zs | Space Separator |
| Zl | Line Separator |
| Zp | Paragraph Separator |
| C | Other |
| Cc | Control |
| Cf | Format |
| Cs | Surrogate |
| Co | Private Use |
| Cn | Not Assigned |
| - | Any* |
| - | Assigned* |
| - | ASCII* |

{{< /wrapTable >}}

## Matcher les caractères d'un alphabet seulement

Si je veux vérifier que mon texte appartient à de l'hébreu ou du chinois c'est faisable. Dans Unicode il faut
remarquer qu'il y a plusieurs notion pour les "alphabets"; il y a les **Blocs** et les **Scripts**, cependant
le moteur de Java qui se base essentiellement sur le moteur de perl, ne gère pas les scripts, donc on se contentera
des blocs.

Ci-dessous je teste l'appartenance à un bloc :

```java
assertFalse(Pattern.matches("(\\p{InBASIC_LATIN}| )+",
                            "une manœuvre sur un chêne"));
assertTrue(Pattern.matches("(\\p{InLATIN_EXTENDED_A}|\\p{InLATIN_1_SUPPLEMENT}|\\p{InBASIC_LATIN}| )+",
                           "une manœuvre sur un chêne"));

assertTrue(Pattern.matches("[\\p{InLATIN_1_SUPPLEMENT}\\p{InBASIC_LATIN} ]+",
                           "eine kleine Straße in München"));

assertTrue(Pattern.matches("[\\p{InCYRILLIC} ]+",
                           "Это настоящая красота"));
assertFalse(Pattern.matches("[\\p{InHEBREW} ]+",
                            "Это настоящая красота"));

assertTrue(Pattern.matches("[\\p{InCJK_UNIFIED_IDEOGRAPHS} ]+",
                           new String(Character.toChars(0x6C23)))); // chi écriture traditionnel
assertTrue(Pattern.matches("[\\p{InHIRAGANA} ]+",
                           new String(Character.toChars(0x304D)))); // ki écriture Hiragana
```

Plusieures choses sont à remarquer :

* Le nom de l'alphabet est précédé par `In`
* Pour avoir une phrase en français on a très vite plusieurs blocs `LATIN EXTENDED A` pour le graphème *`œ`*, `LATIN 1 SUPPLEMENT` pour le *`ê`* e accent circonflexe.
* D'autres alphabet sont plus pratique à utiliser comme l'hébreu, le cyrillique, le grecque, etc.
* L'utilisation des alphabet Chinois, Japonais, Coréen peut aussi soulever des question surtout quand on ne le parle pas ;)



> **À noter également** : Sur les deux dernières lignes noter que j'ai utilisé le code hexadécimal **UTF-16**
> (j'y reviendrais après) pour obtenir les caractères <span style="font-size: large;">氣</span> et
> <span style="font-size: large;">き</span> (Chi en chinois traditionnel, Ki avec l'alphabet Hiragana).
> Pourquoi? Parce que Unicode c'est bien joli mais dans le monde réel il y a des limitations, pour moi il s'agit
> de la police de caractère de mon éditeur qui ne possède pas ces blocs de caractères défini. Peut-être aurez vous
> des limitations sur la police de votre navigateur.
> À noter également que l'encodage de vos fichier peut faire mal quand on joue avec les caractères en dehors du
> latin basique.
>
> {:.alternate}
> | ![0x6C23](/assets/0x6C23-chi.png) | [Chi (0x6C23)](http://www.fileformat.info/info/unicode/char/6c23/index.htm) |
> | ![0x304D](/assets/0x304D-ki-hiragana.png) | [Ki (0x304D)](http://www.fileformat.info/info/unicode/char/304d/index.htm) |



## On peut encore s'amuser

Pour revenir dans les choses qui nous intéresse, imaginons que nous voulions compter tous les caractères accentués
dans un texte. Le bloc Unicode `\p{L}` n'est pas approprié, mais comme je l'ai dit avec Unicode on peut accéder
aux propriété d'un caractère.

Déjà pour commencer il faut savoir qu'en Unicode, un graphème comme *`é`* peut correspondre à un seul caractère *`é`*
ou à deux caractères *`e`* suivi du modificateur accent grave. Cela dépend de la source, mais **ces cas sont probables**.

```java
@Test
public void graphemes() {
    System.out.println(
            "Lettre é accentuée Latin1 : é" + "\n" +
            "Lettre ê accentuée Latin1 : ê" + "\n" +
            "Lettre e accentuée avec modificateur unicode : e\u0301" + "\n" +
            "Lettre e accentuée avec modificateur unicode : \u0065\u0302");

    assertTrue(Pattern.matches("\p{InLATIN_1_SUPPLEMENT}+", "éèê\u00E9"));
    assertFalse(Pattern.matches("\p{InLATIN_1_SUPPLEMENT}+", "e\u0301"));
    assertTrue(Pattern.matches("(\p{L}\p{M})+", "e\u0301"));
    assertTrue(Pattern.matches("(\p{InLATIN_1_SUPPLEMENT}|\p{L}\p{Mn})+", "éêe\u0301\u0065\u0302"));
}
```

Ainsi dans les lignes précédentes pour rechercher un graphème représenté par un seul codepoint, il faudra aller
le chercher dans le bloc idoine, ici `LATIN 1 COMPLEMENT`, 0x00E9 est le codepoint du caractère *`é`*. La forme
décomposée de *`é`* est *`e`* (0x0065) suivi du modificateur accent grave (0x0301).

Pour matcher cette forme décomposée du graphème, il faut simplement écrire `\p{L}\p{M}`. Il est toujours possible
d'affiner l'expression en choisissant des propriétés plus précises (cf. Tableau plus haut, voire la référence Unicode).
Du coup pour matcher n'importe quelle forme d'un graphème on pourra écrire l'expression de la ligne 6.

Enfin rapidement on peut exprimer les compléments à la manière standard avec `[^\p{Lu}]` ou plus simple avec un
grand `P` `\P{Lu}`. Les intersections entres les classes / propriétés Unicode se font sans problèmes également :

```java
assertTrue(Pattern.matches("[^\p{Lu}]+",
                           "une manœuvre sur un chêne")); // exclusion
assertFalse(Pattern.matches("[^\p{Lu}]+",
                            "Une Manœuvre sur un chêne"));
assertFalse(Pattern.matches("\P{Lu}+",
                            "Une Manœuvre sur un chêne")); // complément (grand P)

assertFalse(Pattern.matches("[[^\p{Lu}]&&\p{IsL} ]+",
                            "une manœuvre sur un chêne 123164")); // exclusion et intersection
assertTrue(Pattern.matches("[[^\p{Lu}]&&\p{IsL} ]+",
                           "une manœuvre sur un chêne")); // exclusion et intersection
```

## Petit retour sur les base de Java

Java gère nativement Unicode, les **String sont encodées en UTF-16**. Ce qui explique par conséquent que lorsque je
veux exprimer un caractère sous forme hexadécimale, il faut **l'écrire dans sa forme UTF-16**.

```java
@Test
public void utf16() throws Exception {
    assertTrue(Pattern.matches("\u00E9", "é")); // char UTF-16 compris par le compilateur
    assertTrue(Pattern.matches("\u00E9", "é")); // char UTF-16 échappé compris par la classe Pattern
    assertTrue(Pattern.matches("\u00E9", new String(Character.toChars(0x00E9))));
    assertTrue(Pattern.matches("\u00E9", new String(Character.toChars(0x00E9))));
}
```

Ces assertions marches toutes mais il faut noter que `\u00E9` est compris par le compilateur et remplacera `\u00E9`
par *`é`*, alors que dans la forme ou le backslash est échappé `\u00E9` le compilateur ne fera rien. Ce sera au
moteur `Pattern` de traiter la chaîne.

```java
@Test
public void charLengthForCodePoint() throws Exception {
    assertEquals(1, Character.toChars(0x00E9).length); // é
    assertEquals(1, Character.toChars(0x304D).length); // ki
    assertEquals(2, Character.toChars(0x0001D50A).length); // MATHEMATICAL FRAKTUR CAPITAL G
}
```

La plupart des caractères tiendront dans le type primitif `char` qui fait donc **16 bits** (voilà pourquoi Java gère
nativement l'UTF-16), cependant il peut arriver que certains caractères demandent davantage. `Character.toChars(int)`
prend donc un **codepoint** représenté par en **entier**, qui fait en Java **32 bits** pour exprimer Unicode en
UTF-32 donc. Dans le code ci-dessus la 3ème assertion montre d'ailleurs que Java doit splitter le caractère
en question sur deux `char`.

De la même manière l'encodage change naturellement la taille d'un tableau de `byte` (**8 bits**).

```java
@Test
public void encodingDifferenceForAsciiChars() throws Exception {
    String string = "une chaine ascii";
    assertEquals(string.length(), string.getBytes("ASCII").length);
    assertEquals(string.length(), string.getBytes("UTF-8").length);
}

@Test
public void encodingDifferenceForAccentedChars() throws Exception {
    String string = "un chêne, un frêne, une orchidée";
    assertTrue(string.length() == string.getBytes("ASCII").length);
    assertEquals(string.length() + 3, string.getBytes("UTF-8").length);
}
```

# Bilan

Voilà cet article clos la série que je voulais écrire sur les expressions régulière. Il y a probablement d'autres 
arcanes à connaître. Mais sur cette série le but était de couvrir ce que le moteur Java nous permet de faire.
Je pense que comprendre le fonctionnement du moteur en particulier sur le backtracking, la manière du moteur de
tester une expression, la manière dont le moteur parcoure / consomme les caractères en entrée, sont des facteurs
clé pour réussir une bonne expression. Cette compréhension est d'autant plus importante quand celles-ci sont liée à
des éléments de performance.

Les constructions apportées avec Unicode, même limitées, ouvrent certaines possibilités intéressantes, mais clairement
il y a du travail à faire : Unicode n'est manifestement pas simple.

# Références

* Le tutorial perl : [http://perldoc.perl.org/perlretut.html](http://perldoc.perl.org/perlretut.html)
* La classe Pattern : [http://download.oracle.com/javase/1.5.0/docs/api/java/util/regex/Pattern.html](http://download.oracle.com/javase/1.5.0/docs/api/java/util/regex/Pattern.html)
* Unicode Regular Expressions: [http://unicode.org/reports/tr18/](http://unicode.org/reports/tr18/)
* Unicode Character Datablase : [http://www.unicode.org/Public/5.1.0/ucd/UCD.html](http://www.unicode.org/Public/5.1.0/ucd/UCD.html)
* FileFormat, pour en savoir plus sur un certain caractère :  [http://www.fileformat.info/info/unicode/char/search.htm](http://www.fileformat.info/info/unicode/char/search.htm)
* Types primitifs en Java [http://download.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html](http://download.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html)
