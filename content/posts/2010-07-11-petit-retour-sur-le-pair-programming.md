---
authors: ["brice.dutheil"]
date: "2010-07-11T21:44:41Z"
published: true
status: publish
tags:
- agile
- agilité
- architecture
- code
- pair-programming
- scrum
- binomage,
- binome
- expérience
- agile
- scrum
slug: petit-retour-sur-le-pair-programming
title: Petit retour sur le pair-programming
type: post
---
Lors de ma mission précédente, une des unités business a décidé d'investir dans Scrum, avec ce changement de méthodologie, les équipes de développement étant relativement enthousiastes, ont été formées au TDD et au pair-programming. Une discussion avec un pote, nous a amené à parler du pair-architecturing, ou la confrontation des idées, le challenge apporté par son alter-ego, m'a conduit à écrire ce petit retour à propos du pair-programming, et pourquoi l'appliquer à d'autres discipline n'est pas une mauvaise idée, au contraire.

Après plus d'un an passé dans ce contexte d'agilité avec Scrum, je vous livre quelques pensées sur le pair-programming.

# D'abord l'évolution

Toutes les équipes n'ont pas choisi d'adopter le pair-programming comme pratique régulière pour l'ensemble des développements.

1. Avant Scrum, les développeurs se voyaient confiés certains dossiers, et chacun travaillait vaguement dans son coin avec parfois l'aide des autres.

2. Coup de bol expérience de refactoring de l'architecture. J'ai eu l'occasion en temps que développeur de travailler avec un autre développeurs sur l'architecture de l'application. Les enjeux sont importants, ce serait dommage de se louper et de planter une version.

    > A cette époque là j'ai vraiment eu plaisir à travailler avec l'autre développeur, à faire ce que j'appellerai du ***pair-architecturing***.

3. En effet, au démarrage de Scrum les développeurs n'étaient pas encore près à faire le changement, moi y compris:

    > J'étais à l'aise seul devant mon poste, et parfois je demandais l'aide ou le retour des membres de mon équipes, et cela me convenait bien.

4. Ensuite l'assignation des taches est petit à petit sorti mais en partie seulement de la responsabilité des développeurs, par conséquent le choix de faire du pair-programming était de moins en moins une option possible pour le développement. C'est dommage.

5. Pendant les phases (par développeur) destinées à la maintenance, il fallait transmettre la connaissance métier, j'ai vu et même participé à l'analyse de problèmes métier complexes, très spécifiques, mais sur des domaines très variés. A ce moment il ne s'agit pas encore véritablement de pair-programming, mais de ***pair-analysing***. Cette étape finalement couteuse en temps pour ceux qui possèdent la connaissance métier et la connaissance du code afférent est nécessaire pour les développeurs qui passent donc par cette case maintenance.

    > J'ai trouvé ces moments de pair-analysing comme particulièrement intéressant, car très riche en métier, et surtout très formateurs sur les chose à ne pas faire, typiquement lorsqu'il faut corriger du code legacy, le design de celui-ci devient une caractéristique majeure du temps de compréhension et du temps de correction d'anomalies. Egalement je ne faisais déjà plus vraiment confiance aux commentaires, mais ces passages ont à nouveau enfoncé le clou.

6. Un sujet technique assez poussé et sur un sujet délicat à maitriser, pour terminer ce projet, il a été décidé de staffer les deux personnes qui avait bossé dessus (seules mais à la suite l'une de l'autre pour des raisons de planning). A deux donc nous avons décidé de faire du pair-programming. C'est la première véritable expérience de pair que j'ai eu.

    > Et j'en ai été très heureux, car à deux avec un niveau relativement équivalent, on a pu travailler avantageusement le design du code, et la testabilité de nos design. Egalement aussi on a pu penser au cas limites bien mieux que lorsqu'on avait travaillé chacun de notre coté, et pourtant nous avions fait régulièrement des réunions (informelles) avec l'architecte pour discuter des points sombres.


7. Puis arrivé dans une équipe avec des newbies sur le projet; il fallait transmettre les connaissances. Et là c'est la volonté forte du nouveau scrum master de pousser le pair-programming, j'ai définitivement apprécié cette pratique quand j'ai travaillé dans cette équipe, j'ai vécu la plupart du temps des succes story, mais aussi quelques petits écueils et inconvénients, j'en fait donc part dans la suite de l'article.

    Nous avons pratiqué le pair-programming pour l'écriture de nouveau code, pour la réhabilitation de code legacy, et pour le refactoring de code legacy (ce n'est pas la même chose).

    > Ce que je retiendrais c'est que l'équipe était reconnue comme véloce, et de mon point de vue je pense que le travail réalisé était plutôt bon. Et que définitivement le travail aurait pris bien plus de temps et aurait été moins bien fait si chacun était resté sur ses tâches.

# Les retours enfin

Honnêtement je pense que travailler en binôme est vraiment très bien et très bon pour un projet, en particulier si le code du projet doit survivre longtemps. Mais il y a certaines choses à éviter.

1. Le pair-programming c'est lent et ça coute cher, c'est ce qu'on peut vous dire, mais ceux qui avancent ça n'ont aucun argument pour étayer ces propos.

    1. A propos de la lenteur : il n'y a pas de mesures que je connait qui vont dans ce sens ou dans l'autre d'ailleurs.

        > C'est la raison pour laquelle je souhaite témoigner, et je tiens à dire que c'est **l'équipe qui favorisait au maximum le pair-programming qui était ressentie comme la plus véloce**.

    2. A propos du coût, effectivement il y a deux éléments qui travaillent ensemble sur un sujet, mais le sujet fonctionnel est finalement mieux maitrisé par les développeurs, les aller-retours entre les deux personnes favorisent l'échange d'information et les réflexions relatives, bref ça favorise le bon sens et l'intelligence. Ces deux choses donnent naturellement **un code mieux réfléchi, plus robuste et plus évolutif**, pour sûr **pour les besoins du présent**, et très probablement **pour les besoins futurs** comme les évolutions ou la maintenance (on ne sait jamais). Évidement faire du vrai code objet et utiliser avantageusement TDD/BDD permet de booster cet aspect. Il en résulte que sur le moyen et le long terme, les couts deviennent avantageux, et encore plus si d'autres aspects entre en jeux comme le <acronym title="Service Level Agreement">SLA</acronym>, les aspects contractuels, légaux, et autres.

2. Travailler à deux n'est pas de tout repos, si vraiment il y a un échange intense, **6h de travail à deux c'est déjà une grosse journée**, franchement on est ruiné, l'un comme l'autre. Faites le comprendre à votre entourage que travailler en binôme est fatiguant (mais productif).

3. Quoi qu'il arrive il y a toujours des mails à dépiler, il y a toujours des interruptions, et même parfois il faut aller interrompre d'autres personnes. Organisez votre temps à deux pour faire ces activités sans gêner le binôme.

4. Quand vous travaillez à deux n'oublier pas d'échanger régulièrement les rôles de pilote (celui qui code) de celui qui observe. C'est très important d'échanger les rôles, ça permet de faire fonctionner l'esprit avec un point de vue différent, ça stimule le cerveau. Le binôme choisira sa cadence.

5. Ce n'est pas une relation professeur/enseignant, c'est une relation qui se base sur les responsabilités :

    1. celui qui code qui a le clavier entre les mains qui a la seule responsabilité de penser le code et de l'écrire

    2. celui qui à accès aux docs papier qui a le temps de prendre du recul

    Encore une fois il doit y avoir un échange régulier entre le driver et l'observer.


6. **Il faut savoir essayer les idées des autres!** Surtout s'il n'y a pas de contre-indications et que les deux idées se valent (avant de les mettre en application).

7. **La différence de niveau des deux commendataires ne doit pas être trop grande**, effet, c'est irritant, ennuyant, pénible, une perte de temps pour celui qui a les compétences, et ça ne permet pas de former adéquatement le plus faible. En bref ce binôme est à la fois une perte d'argent et de temps. Pour former le newbie il faut utiliser autre chose.

8. Tous le monde ne sait pas travailler en binôme, il ne faut pas forcer une personne qui ne sait pas ou ne veut pas faire du binômage. Cette approche demande des compétences sociales importantes (quelque soit le rôle) comme de la patience, de l'humilité, du calme. Et ce que je peux dire c'est que j'ai vraiment eu la chance de m'améliorer sur ces qualité grâce au pair-programming.

9. Le design du code et des tests est plus propre, plus intelligibles, les impacts des changements mieux maitrisés, bref que du bien pour le code (même s'il peut toujours y avoir mieux, mais le mieux est l'ennemi du bien à ce qu'il parrait).

10. **C'est un tandem dans lequel chacun protège l'autre de faire de la sur-ingénierie, ou inversement de prendre des raccourcis**. Il ne faut pas seulement avoir du code correct, il faut aussi avoir un code solide pour les gens de la maintenance, pour les gens de l'exploitation, pour les futurs ingénieurs.

# Finalement

Le pair programming est une pratique remarquablement efficace, quand elle est bien appliquée. C'est un véritable bénéfice pour tout de suite, mais surtout pour demain. Et c'est bien le demain qui est souvent le grand oublié des clients, ils ne voient pas les couts et les problèmes de notre métier qu'il faudra adresser sur du code legacy lors d'un refactoring, lors d'une évolution ,ou lors d'une correction d'anomalie.

Egalement je trouve que le code objet est véritablement le meilleur outils lorsqu'on travaille en pair-programming. Ce langage permet vraiment de mieux exprimer ce qui ressort des échanges observateurs/pilote. A deux il faut se protéger et s'inciter mutuellement pour faire du bon code.

L'utilisation en plus de TDD, et même de BDD qui est plus orienté responsabilité et comportement booste encore la qualité du code et de réfléchir en terme de business, de métier.

Pour aller plus loin je pense que le travaille en binôme favorise l'intellect et la consommation la plus exhaustive des scénarii métier. L'appliquer au développement est manifestement très bien, mais l'appliquer à d'autre métier est encore mieux. Typiquement pour des rôles aussi importants et impactants que l'architecture, avoir en face de soi un challenger, qui remet véritablement en question les élément sur les quels il n'est pas d'accord est un vrai plus. En plus de transmettre la connaissance, cette confrontation solidifie l'ensemble.

Je suis content et même reconnaissant d'avoir pu travailler avec la plupart des personnes en binôme, il m'ont énormément appris. Pour peu que chacun accepte le dialogue et argumente constructivement, il n'en ressortira que du bon.

Vous avez des remarques ou des retours à faire partagez, n'hésiter pas!
