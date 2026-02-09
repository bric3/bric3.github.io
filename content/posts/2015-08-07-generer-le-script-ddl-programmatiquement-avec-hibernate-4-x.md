---
authors: ["brice.dutheil"]
date: "2015-08-07T15:26:51Z"
meta:
  _edit_last: "1"
  _oembed_c2a410587a6c92fa5dbab70707099e19: '{{unknown}}'
  _su_rich_snippet_type: none
status: publish
tags:
- architecture
- code
- tips
- ddl
- hibernate
- java8
- jpa
slug: generer-le-script-ddl-programmatiquement-avec-hibernate-4-x
title: Générer le script DDL programmatiquement avec Hibernate 4.x
type: post
---
Si par hasard votre base donnée est gérée par un véritable DBA, donc avec des scripts SQL. Mais que vous utilisez
hibernate pour mapper les tables avec une configuration non triviale, modules bien découpés, package annotés,
etc.... Les utilitaires comme [hibernate4-maven-plugin](http://juplo.de/hibernate4-maven-plugin/) ne suffisent plus.

Voici un petit exemple code qui utilise le `SchemaExporter` de hibernate. _Le code qui suit est bien sûr à adapter
à la structure du code de l'application._

Le principe est de passer soit même les classes annotées **et** les package annotés (typiquement par `@TypeDef`
dans le `package-info.java`). Pour plus de commodité ce code utilise le framework
[Reflections](https://github.com/ronmamo/reflections) pour scanner les classes annotées par les annotations JPA
`@Entity` et `@MappedSuperClass`. Par défaut le script génère les `drop statements`, mais ce comportement peut
se changer à travers les options de `SchemaExport`.


```java
import javax.persistence.Entity;
import javax.persistence.MappedSuperclass;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.cfg.Configuration;
import org.hibernate.tool.hbm2ddl.SchemaExport;
import org.hibernate.tool.hbm2ddl.Target;
import org.junit.Test;
import org.reflections.Reflections;
public class HibernateDDLGenerator {
    public static final String ENTITIES_PACKAGE = "com.something";
    public static final String ANNOTATED_PACKAGE = "com";
    public static final String HBM_DIALECT = "org.hibernate.dialect.Oracle10gDialect";
    @Test
    public void ddl() throws Exception {
        new SchemaExport(createHibernateConfig())
                .setOutputFile("/tmp/ddl.sql")
                .setFormat(true)
                .setDelimiter(";")
                .create(Target.EXPORT);
    }
    private Configuration createHibernateConfig() {
        Configuration conf = new Configuration();
        final Reflections reflections = new Reflections(ENTITIES_PACKAGE);
        reflections.getTypesAnnotatedWith(MappedSuperclass.class)
                   .forEach(conf::addAnnotatedClass);
        reflections.getTypesAnnotatedWith(Entity.class)
                   .forEach(conf::addAnnotatedClass);
        conf.addPackage(ANNOTATED_PACKAGE) // contains @TypeDefs
            .setProperty(AvailableSettings.DIALECT, HBM_DIALECT);
        return conf;
    }
}
```

[Source : gist 370654ecad0eb81aca22](https://gist.github.com/bric3/370654ecad0eb81aca22)

{{< draftNotes >}}

{{< gist bric3 370654ecad0eb81aca22 >}}

{{< /draftNotes >}}