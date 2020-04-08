---
authors: ["brice.dutheil"]
date: "2010-02-09T17:32:06Z"
meta:
  _edit_last: "1"
  _su_rich_snippet_type: none
  _syntaxhighlighter_encoded: "1"
published: true
status: publish
tags:
- code
- joda-time
slug: a-propos-de-joda-time
title: A propos de Joda-Time
type: post
---
Je suis un peu surpris de voir que beaucoup de développeurs utilisent encore énormément l'API temps du JDK. C'est la raison pour laquelle j'ajoute une nouvelle entrée sur le web à ce sujet.

Ce n'est une nouvelle pour personne qui connait Java un minimum que les classes **java.util.Calendar** et **java.util.Date** ne sont pas pratique à utiliser. Mais en plus de ça, leur implémentation laisse à désirer, elles ne sont pas thread-safe, leur performanceest  au mieux variable et, ... elles sont surtout buggées (même dans le dernier JDK). N'oublions non plus de mettre dans le lot le **SimpleDateFormat**, qui n'est bien sur lui aussi pas thread-safe. Et je ne parle pas des classes **java.sql.Date**, **java.sql.Time** et **java.sql.Timestamp** dont leur implémentation est fondée sur **java.util.Date**, ce qui leur donne droit à une implémentation un peu étonnante.

Malheureusement comme ces classes font partie du JDK depuis très longtemps et qu'elle ne sont toujours pas dépréciée, ces classes restent, et leur bug aussi, ou d'autres sont créés. Vous l'avez compris ces classes sont a éviter.

Heureusement une API a émergé il y a quelques années pour fournir une implémentation d'une API Temps solide, performante, consistante et agréable à utiliser. Il s'agit de Joda-Time. Cette API a été la fondation ou plutôt un exercice intellectuel, pour l'implémentation de référence de la [JSR-310](http://jcp.org/en/jsr/detail?id=310). Aujourd'hui cette implémentation de référence est un peu différente de celle de Joda-Time, et avec raison Joda-Time a aussi quelques défauts.

Cela dit en attendant que cette JSR soit effectivement intégrée à une version officielle du JDK, on pourra se contenter de Joda-Time qui reste pour le moment la meilleure API Temps.

## Alors que peut-on faire avec Joda-Time

Pour commencer, on peut remplacer les appels à

```java
Calendar cal = Calendar.getInstance();
Date date = new Date();
```

par les appels suivant, on peut jouer un peu avec l'API :

```java
DateTime now = new DateTime();
DateTime inYear2000 = now.withYear(2000);
DateTime twoHoursAndOneMinuteLater = now.plusHours(2).plusMinutes(1);
```

Comme l'objet String, **DateTime** est immutable, des nouvelles instances sont créés à chaque fois, ce qui veut également dire que l'objet est thread-safe. Dans Joda-Time, **DateTime** représente un instant (interface **ReadableInstant**).

Les autres classes représentant des instants sont **Instant** et **DateMidnight**. **Instant** correspond juste à un instant en milliseconde depuis 1970. **DateMidnight** est un instant ou l'heure est positionnée à minuit.

```java
DateTime _2010 = new DateTime("2010-01-01T00:00:00");
DateMidnight _2010midnight = new DateMidnight("2010-01-01T00:00:00");
DateMidnight _2010stillMidnight = new DateMidnight("2010-01-01T20:34:00");

_2010.equals(_2010midnight); // true
_2010.equals(_2010stillMidnight); //true
_2010.withZone(DateTimeZone.forOffsetHours(2)).equals(_2010midnight); //false
```


Ou avec les instants :

```java
Instant _2010instant = new Instant(_2010);

_2010.equals(_2010instant); // false
_2010.withZone(DateTimeZone.UTC).equals(_2010instant); // true
```


Observez les différence de TimeZone, en effet par défaut si la TimeZone n'est pas précisée, il s'agira de la zone locale.

On peut jouer avec les propriétés de ces objets, par exemple :

```java
_2010midnight.monthOfYear().getAsText(); // janvier
_2010midnight.monthOfYear().getAsText(Locale.GERMAN); // Januar
_2010midnight.monthOfYear().getDifference(new DateMidnight("2009-04-10")); // 8
```


Un peu plus sympa c'est la gestion des intervalles / durées / périodes.

```java
Duration _30daysDuration = Duration.standardDays(30);
new DateMidnight("2010-01-31").equals(_2010.plus(_30daysDuration)); // true
new DateMidnight("2010-03-02").equals(_2010.plus(_30daysDuration).plus(_30daysDuration)); // true

Period _1month = Period.months(1);
new DateMidnight("2010-02-01").equals(_2010.plus(_1month)); // true
new DateMidnight("2010-03-01").equals(_2010.plus(_1month).plus(_1month)); // true
```


Joda-Time apporte également des objets dont les concepts ne concerne qu'une date ou que le temps. Il est facile de convertir un instant vers un de ces objets.

```java
// _2010 = "2010-01-01T00:00:00+01:00" car timezone locale
_2010.withZone(DateTimeZone.forID("Europe/London")).toLocalDate(); // 2009-12-31
_2010.toLocalDate(); // 2010-01-01

LocalTime _15h28 = new LocalTime("15:28");
_15h28.isAfter(new DateTime("2010-01-01T00:00:00").toLocalTime()); // true
```


Joda-Time offre aussi un petit utilitaire qui permet de vérifier certains comportement dépendant du temps :

```java
DateTime now = new DateTime();
DateTimeUtils.setCurrentMillisOffset(-60 * 60 * 1000); // - 1h
DateTime past = new DateTime();
past.isAfter(now); // false
past.isAfter(System.currentTimeMillis()); // false
```

Modifier le temps à travers cette API change seulement le temps dans pour la JVM courante, et non sur le système.

Formater une date, pour rappel **DateTimeFormat** est thread-safe et génère également des objets thread-safe, la documentation indique aussi la présence d'un **DateTimeFormatterBuilder** pour construire des formatter plus complexes.

```java
DateTimeFormatter fmt = DateTimeFormat.forPattern("yyyyMMdd");
DateTimeFormatter frenchFmt = fmt.withLocale(Locale.FRENCH);
DateTimeFormatter germanFmt = fmt.withLocale(Locale.GERMAN);

fmt.print(new DateTime());
frenchFmt.parseDateTime("20100208")
```


Ah j'allais oublier comment passer des objets du JDK vers les objets Joda-Time et vice-versa :

```java
Calendar now = new DateTime().toGregorianCalendar();
Date date = new DateTime(now).toDate();
date = new LocalDate().toDate();
Calendar todayAt5 = new LocalTime(now).withHourOfDay(5).toDateTimeToday().toGregorianCalendar();
Calendar tomorowAt5 = new LocalTime(now).withHourOfDay(5).toDateTime(new DateTime().plusDays(1)).toGregorianCalendar();
```


Ce genre de manipulation, bien que relativement aisée grâce à Joda-Time, sont pénible pas très élégantes, et finalement elle pénalise bêtement les performances en repassant aux objets du JDK, il est donc préférable d'utiliser tout au long de l'application des objet Joda-Time et de n'utiliser que des objets du JDK lorsque celà est nécessaire.

Comme vous venez de le voir, Joda-Time offre un belle API, celle-ci a certainement ses défauts, mais elle offre un bel avantage sur les autres pour sa fluidité de concepts, son efficacité ou sa clarté. En attendant que la JSR-310 soit intégrée au JDK, et que ce JDK soit décliné dans sa version J2EE, cette API a encore une belle vie devant elle.

Cela dit pour certaines utilisations spécifiques, il faudra faire attention à ces objets, j'ai vu passer des mailing list sur Terracota qui parlent justement de Joda-Time et de leurs problèmes rencontrés. Encore une fois il s'agit d'un cas particulier ou en plus la JVM est instrumentée.

Pour ceux que ça intéresse, il semblerait que les besoins dans le monde de la finance sont un peu plus poussés. Je ne connais pas bien ces *dates financières*. En tous cas il existe une bibliothèque ayant ce support, c'est **jFin**.

Également aussi, une librairie de tag JSP permet d'utiliser à pleine puissance les objets de Joda-Time dans les JSP.

Pour finir, j'ai dit une bêtise, il y a d'autres choses à ajouter, faites vous plaisir avec les commentaires.

Sources:


* [http://www.wolkje.net/2010/01/06/java-date-and-time-api-and-jsr-310/](http://www.wolkje.net/2010/01/06/java-date-and-time-api-and-jsr-310/)
* [http://www.jroller.com/scolebourne/entry/why_jsr_310_isn_t](http://www.jroller.com/scolebourne/entry/why_jsr_310_isn_t)
* [http://joda-time.sourceforge.net/](http://joda-time.sourceforge.net/)
* [http://joda-time.sourceforge.net/contrib/jsptags/](http://joda-time.sourceforge.net/contrib/jsptags/)
* [http://en.wikipedia.org/wiki/JFin](http://en.wikipedia.org/wiki/JFin)
