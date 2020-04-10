---
authors: ["brice.dutheil"]
date: "2017-10-19T00:00:00Z"
published: true
tags:
- ssl
- tls
- https
- java
- okhttp
- openssl
- trustmanager
- certificate authority
- self-signed certificate
- certificat auto-signé
slug: self-signed-certificates-in-java
title: HTTPS en Java avec un certificat auto-signé
---

Votre application doit se connecter à un serveur HTTPS, normalement pas de problème,  
en craftman on se dit qu'il faudrait écrire des tests unitaires afin de s'assurer
que le code fonctionne avec des URI HTTPS.

Le code suivant utilise **wiremock**, ce test va juste vérifier que le 
client se connecte sans problème sur le port HTTPS de wiremock.

```java
public class WireMockSSLTest {
    @Rule
    public WireMockRule wireMock = new WireMockRule(wireMockConfig().dynamicPort()
                                                                    .dynamicHttpsPort());

    @Test
    public void ssl_poke() throws IOException {
        new OkHttpClient.Builder().build()
                                  .newCall(new Request.Builder().get()
                                                                .url("https://localhost:" 
                                                                     + wireMock.httpsPort())
                                                                .build())
                                  .execute();
    }
}
```

À l'exécution ce code lève l'exception suivante:

```
javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
	at ...
Caused by: sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
	at ...
	... 10 more
Caused by: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
	at ...
	... 16 more
```

C'est impressionnant au premier abord, on y voit des acronymes qui font peur (PKIX)
des packages `sun`. Alors que dit cette stacktrace : 

* `SSLHandshakeException` : il s'agit d'une erreur de négociation SSL
* `ValidatorException: PKIX path building failed` : le client n'arrive pas à 
    construire la _chaine_ des certificats en suivant la norme **PKIX**

Autrement dit, ce serveur (wiremock) expose un certificat, mais le client n'arrive 
pas à remonter la chaine des certificats jusqu'à une **autorité** connue pour le 
vérifier. Pourquoi cette exception? Le même code qui se connecte sur `https://google.com`
fonctionnera sans cette erreur. Le soucis vient du fait que wiremock utilise un 
**certificat auto-signé**, et ce certificat auto-signé n'est pas reconnu comme valide
par les réglages par défaut de la JVM.

Dans cet article, nous allons voir les différentes approches pour gérer un 
**certificat auto-signé**, et explorer les moyens de contrôler quel certificat est 
utilisé dans son environnement de test en générant soi même son certificat auto-signé.

## Bref rappel sur SSL, enfin plutôt TLS ?

Quand on parle de _SSL_ aujourd'hui, on fait l'amalgame de deux protocoles, de TLS et 
de son prédécesseur SSL.

* SSL est l'acronyme de **S**ecure **S**ockets **L**ayer, ce protocole a été développé 
    par **Netscape** (pour ceux qui se rappellent du navigateur concurrent de Internet 
    Explorer).
    La dernière version SSLv3 est considérée comme dépréciée depuis 2015.
* TLS est l'acronyme de **T**ransport **L**ayer **S**ecurity, ce protocole est le 
    successeur direct du protocole SSLv3 mais ils sont cependant incompatible entre eux.

[[source]](https://en.wikipedia.org/wiki/Transport_Layer_Security)

Ce que fait TLS c'est de s'assurer que le communication entre deux peer soit sécurisée.
TLS [s'appuis notamment sur **PKIX**](https://tools.ietf.org/html/rfc5246#section-7) 
([**P**ublic **K**ey **I**nfrastrcture **X**.509](https://tools.ietf.org/html/rfc5280)) 
et que l'identité du serveur est bien celui qu'il prétend être (grâce à son certificat)
et à celui d'un tiers de confiance. En général il s'agit d'une chaine de confiance.

Par exemple :

> À la connexion sur https://github.com, en premier il faut vérifier le certificat 
> de GitHub, regarder qui a signé ce certificat, vérifier le certificat du signataire
> et ainsi de suite jusqu'à finir sur un certificat d'un tiers de confiance, en 
> général ce dernier certificat est celui d'une autorité de certification.

Ces certificats appelés certificats **X.509** portent des informations comme le 
nom du serveur, le nom du signataire, la signature, etc.

Un certificat peut-être sauvé dans un fichier encodé soit au format binaire `DER`
soit encodé au format US-ASCII `PEM`.

> À noter l'extension `CRT` correspond bien à un certificat qu'il soit encodé au format 
> `DER` ou au format `PEM`. L'extension `CER` est une forme alternative de microsoft.


## Fixer le code pour que le test passe

### Faire confiance à tout le monde

Pour accepter ce certificat auto-signé, il est possible de configurer la 
socket SSL pour accepter tous les certificats.

```java
@Rule
public WireMockRule wireMock = new WireMockRule(wireMockConfig().dynamicPort()
                                                                .dynamicHttpsPort());

@Test
public void ssl_poke() throws IOException {
    X509TrustManager trustManager = TrustAllX509TrustManager.INSTANCE;
    OkHttpClient client = new OkHttpClient.Builder()
            .sslSocketFactory(
                    sslContext(null,
                                new TrustManager[]{trustManager}).getSocketFactory(),
                    trustManager)
            .build();
    try (Response r = client.newCall(new Request.Builder().get()
                                                          .url("https://localhost:"
                                                               + wireMock.httpsPort())
                                                          .build())
                            .execute()) {
        // noop / success
    }
}
```

OkHttp prend en paramètre une factory de socket SSL, ce contexte SSL devra être 
initialisé avec un gestionnaire de confiance personnalisé pour accepter 
n'importe quel certificat. Pour fluidifier la lecture du code la création du 
contexte SSL est faite à part.

```java
public static SSLContext sslContext(KeyManager[] keyManagers, TrustManager[] trustManagers) {
    try {
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(keyManagers,
                        trustManagers,
                        null);
        return sslContext;
    } catch (NoSuchAlgorithmException | KeyManagementException e) {
        throw new IllegalStateException("Couldn't init TLS context", e);
    }
}
```

Le l'architecture du code de cryptographie en Java est très générique, 
ce qui soulève certaines questions sur ces APIs, par exemple pourquoi la méthode 
`SSLContext#init` force l'utilisation de tableaux.
Dans ce cas précis la javadoc de la méthode [`SSLContext#init`](https://docs.oracle.com/javase/8/docs/api/javax/net/ssl/SSLContext.html#init-javax.net.ssl.KeyManager:A-javax.net.ssl.TrustManager:A-java.security.SecureRandom-) 
indique que seul le premier élément du tableau sera utilisé, pour cette raison 
le code plus haut passe un tableau d'un seul élément.

> ```
> javax.net.ssl.SSLContext
> public final void init(KeyManager[] km,
>                       TrustManager[] tm,
>                       SecureRandom random)
>                throws KeyManagementException
>
> Initializes this context. Either of the first two parameters may be null in which 
> case the installed security providers will be searched for the highest priority 
> implementation of the appropriate factory. Likewise, the secure random parameter 
> may be null in which case the default implementation will be used.
>
> **Only the first instance** of a particular key and/or trust manager implementation 
> type in the array is used. (For example, only the first javax.net.ssl.X509KeyManager 
> in the array will be used.)
>
> Parameters:
>     km - the sources of authentication keys or null
>     tm - the sources of peer authentication trust decisions or null
>     random - the source of randomness for this generator or null
> Throws:
>    KeyManagementException - if this operation fails
> ```

L'interface `TrustManager` est une interface vide, mais étant donné qu'il s'agit 
d'un gestionnaire de confiance pour TLS, et que la spécification est uniquement 
basé sur PKIX (X.509), la seule implémentation sera du type `X509TrustManager`,
interface qui défini les méthodes nécessaires pour procéder à la vérification
des certificats.

Pour cette approche le gestionnaire de confiance acceptera tous les certificats,
il ne procède à aucune vérification de la chaine de certificats.

```java
public static class TrustAllX509TrustManager implements X509TrustManager {
    public static final X509TrustManager INSTANCE = new TrustAllX509TrustManager();

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) 
    throws CertificateException { }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) 
    throws CertificateException { }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[0];
    }
}
```

Avec ça le code est censé fonctionner, mais il y a toujours une erreur lors de 
l'accès à notre serveur wiremock : 

```
javax.net.ssl.SSLPeerUnverifiedException: Hostname localhost not verified:
    certificate: sha256//W3v5TDAEE3dl4peiEwpwDKa1OZAna1ITgokQDz0rkQ=
    DN: CN=Tom Akehurst, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=Unknown
    subjectAltNames: []

	at okhttp3.internal.connection.RealConnection.connectTls(RealConnection.java:308)
	...
```

En effet, le code du dessus adresse la question de confiance pour la _couche_ TLS.
Mais en HTTPS, tous les client doivent en fait vérifier l'identité du serveur avec 
le hostname ([RFC 2818](https://tools.ietf.org/html/rfc2818#section-3.1)) ceci 
afin de prévenir les attaques _man-in-the-middle_.

Dans ce cas précis le certificat auto-signé de wiremock ne fournit pas de noms 
alternatifs `subjectAltNames` qui correspondent soit à `localhost` soit aux IPs
locales.

Il est possible d'écrire un `HostnameVerifier` qui accepte tous les hostnames :

```java
public static HostnameVerifier allowAllHostNames() {
    return (hostname, sslSession) -> true;
}
```

```java
new OkHttpClient.Builder()
            .sslSocketFactory(
                    sslContext(null, 
                               new TrustManager[] {TrustAllX509TrustManager.INSTANCE}).getSocketFactory(),
                    TrustAllX509TrustManager.INSTANCE)
            .hostnameVerifier(allowAllHostNames())
            .build()
            .newCall(new Request.Builder().get()
                                          .url("https://localhost:" + wireMock.httpsPort())
                                          .build())
            .execute();
```

Ce code fonctionnera, il est maintenant possible de se connecter à wiremock en HTTPS.

En revanche, cette configuration ne doit pas être utilisée sur du code de production, 
car ce la revient à désactiver la sécurité sur toutes les connections SSL. 
Il faudra donc prévoir un mécanisme de configuration de connexion SSL dans le 
code de production pour conserver des réglages sains en production et relaxer 
la sécurité pour le serveur de test.

À noter par exemple que cet exemple est pensé pour du back-end, mais ce sujet 
touche de près les applications mobiles. Par exemple la 
[documentation Android](https://developer.android.com/training/articles/security-ssl.html#CommonHostnameProbs) 
explique très bien les soucis liés à la vérification du hostname.

#### Vanilla Java

Pour ceux que ça intéresse le code équivalent en configurant `HttpsUrlConnection` :

```java
// Autorise tous les certificats
HttpsURLConnection.setDefaultSSLSocketFactory(trustAllSslContext().getSocketFactory());
new URL("https://localhost:" + wireMock.httpsPort()).openConnection().connect();
```

Il faut ajouter un [`HostnameVerifier`](https://docs.oracle.com/javase/8/docs/api/javax/net/ssl/HostnameVerifier.html) 
qui ne vérifie rien, et de configurer `HttpsURLConnection` avant d'établir la connexion :

```java
HostnameVerifier allHostsValid = (hostname, session) -> true;
HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
HttpsURLConnection.setDefaultSSLSocketFactory(trustAllSslContext().getSocketFactory());
new URL("https://localhost:" + wireMock.httpsPort()).openConnection().connect();
```


### Faire confiance aux certificats auto-signés

Plutôt que d'_éteindre_ la sécurité, une approche plus fine serait de désactiver
la vérification uniquement pour un certificat auto-signé. Mais comment sait-on 
identifier un certificat auto-signé ?

En se connectant avec OpenSSL sur le serveur HTTPS wiremock avec la sous-commande
`s_client` qui fait office de client SSL/TLS.

```sh
echo -n | openssl s_client -connect localhost:8443 2>&1
```

Cette commande donne en retour plein de donnée intéressantes :

```
CONNECTED(00000003)
depth=0 C = Unknown, ST = Unknown, L = Unknown, O = Unknown, OU = Unknown, CN = Tom Akehurst
verify error:num=18:self signed certificate
verify return:1
depth=0 C = Unknown, ST = Unknown, L = Unknown, O = Unknown, OU = Unknown, CN = Tom Akehurst
verify return:1
---
Certificate chain
 0 s:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
   i:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIDgzCCAmugAwIBAgIEHYkuTzANBgkqhkiG9w0BAQsFADBxMRAwDgYDVQQGEwdV
bmtub3duMRAwDgYDVQQIEwdVbmtub3duMRAwDgYDVQQHEwdVbmtub3duMRAwDgYD
VQQKEwdVbmtub3duMRAwDgYDVQQLEwdVbmtub3duMRUwEwYDVQQDEwxUb20gQWtl
aHVyc3QwIBcNMTUwMjI0MTM1ODUwWhgPMjExNTAxMzExMzU4NTBaMHExEDAOBgNV
BAYTB1Vua25vd24xEDAOBgNVBAgTB1Vua25vd24xEDAOBgNVBAcTB1Vua25vd24x
EDAOBgNVBAoTB1Vua25vd24xEDAOBgNVBAsTB1Vua25vd24xFTATBgNVBAMTDFRv
bSBBa2VodXJzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAIAIvMUo
vy4ufnWKxMU0tBdXqtX6RzKYgQvj/82qPAmRiNki8PpPGrF70Lb3WzsUDYB9CsXw
m5VWc9l1XBdGh6zZVFkkSzBtRjyHy8Z8azsIv/YzQF5bRxE2Cvruh7o01Sq1qz5B
kxt0u/NbUUErxKZeA0li1W/op7RC94h0dzob7auruHUvb56NXAJZcu8r2G9jxh9w
WBPC6lSozuCzwfdS4v2ZOQBYpmMz9oJm3ElQUbOrhnVQtgxQicU2oDETwz37IIEw
FV12la+qNIMSOTe6uJj1jEZP22NL2IYq06BT/ZnK6HYIOXAtwURSsf0MN0b8NKBB
NOLQN2juRj+vn6UCAwEAAaMhMB8wHQYDVR0OBBYEFDZ6soXRxD/N2n5b++CVrWbr
XLKWMA0GCSqGSIb3DQEBCwUAA4IBAQBiPfCUg7EHz8poRgZL60PzMdyaKLwafGtF
dshmY1y9vzpPJIoFcIH7crSsmUcRk+XSj5WhSr4RT3y15JsfZy935057f0knEXEf
or+Gi8BlDaC33qX+6twiAaub1inEDc028ZFtEwbzJQYgJo1GvLG2o2BMZB1C5F+k
Nm9jawu4rTNtXktXloNhoxrSWtyEUoDAvGgBVnAJwQXcfayWq3AsCr9kpHI3bBwL
J9NAGC4M8j7z9Aw71JGmwBDk1ooAO6L82W7DWBYPzpLXXeXmHRCxpujKWaveAV2T
cgsQaCmzy29i+F03pLl7Vio4Ei+z9XQgZiN4Awiwz9D+lshnKuII
-----END CERTIFICATE-----
subject=/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
issuer=/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
---
No client certificate CA names sent
Peer signing digest: SHA512
Server Temp Key: ECDH, P-256, 256 bits
---
SSL handshake has read 1387 bytes and written 434 bytes
---
New, TLSv1/SSLv3, Cipher is ECDHE-RSA-AES128-GCM-SHA256
Server public key is 2048 bit
Secure Renegotiation IS supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.2
    Cipher    : ECDHE-RSA-AES128-GCM-SHA256
    Session-ID: 59D642ED8CCB7F4219617B3739CB93E1C294F873854C2A284D28A77D674AC050
    Session-ID-ctx: 
    Master-Key: A43DF026E3FA620BC7CC5207D5BCB87828B7E3D673CFEEF12CAB425619B63610F443FB96FEC33CC50FBBAC73C152572B
    Key-Arg   : None
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    Start Time: 1507214061
    Timeout   : 300 (sec)
    Verify return code: 18 (self signed certificate)
---
DONE
```

Typiquement :

```
depth=0 C = Unknown, ST = Unknown, L = Unknown, O = Unknown, OU = Unknown, CN = Tom Akehurst
verify error:num=18:self signed certificate
```

La vérification du certificat indique le code `18` et indique qu'il s'agit d'un 
certificat auto-signé. Plus précisément le [wiki openssl](https://wiki.openssl.org/index.php/Manual:Verify(1)) 
indique :

> **18 X509_V_ERR_DEPTH_ZERO_SELF_SIGNED_CERT**: self signed certificate

Donc une chaine avec une profondeur de `0` correspond en fait à un certificat non-signé

Il y a aussi la chaine de certificat elle même avec, pour chaque certificat, la 
première ligne **`s`** qui indique le _sujet_ du certificat, et une deuxième 
ligne **`i`** qui indique l'_issuer_ du certificat. Le chiffre indique la _profondeur_
du certificat.

```
Certificate chain
 0 s:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
   i:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
```

Ce que ça veut dire c'est qu'il est possible d'écrire un trust manager capable 
de vérifier les chaines de certificats usuelles et de détecter les certificats 
auto-signés pour leur appliquer une vérification spécifique. 

```java
public static class TrustSelfSignedX509TrustManager implements X509TrustManager {
    private X509TrustManager delegate;

    private TrustSelfSignedX509TrustManager(X509TrustManager delegate) {
        this.delegate = delegate;
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        delegate.checkClientTrusted(chain, authType);
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        if (isSelfSigned(chain)) {
            return;
        }
        delegate.checkServerTrusted(chain, authType);
    }

    private boolean isSelfSigned(X509Certificate[] chain) {
        return chain.length == 1;
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return delegate.getAcceptedIssuers();
    }

    public static X509TrustManager[] wrap(X509TrustManager delegate) {
        return new X509TrustManager[]{new TrustSelfSignedX509TrustManager(delegate)};
    }
}
```

Ce code _décore_ un trust manager existant en ajoutant un comportement spécifique
pour les certificats auto-signés.

Il s'utilisera de la manière suivante en décorant le gestionnaire de confiance par défaut de la JVM : 

```java
X509TrustManager trustManager = TrustSelfSignedX509TrustManager.wrap(systemTrustManager());
new OkHttpClient.Builder()
            .sslSocketFactory(
                    sslContext(null, 
                               new TrustManager[] { trustManager }).getSocketFactory(),
                    trustManager)
            .hostnameVerifier(allowAllHostname())
            .build()
            .newCall(new Request.Builder().get()
                                          .url("https://localhost:" + wireMock.httpsPort())
                                          .build())
            .execute();
```

On accède au gestionnaire par défaut avec ce code.

```java
public static X509TrustManager systemTrustManager() {
    TrustManager[] trustManagers = systemTrustManagerFactory().getTrustManagers();
    if (trustManagers.length != 1) {
        throw new IllegalStateException("Unexpected default trust managers:"
                                        + Arrays.toString(trustManagers));
    }
    TrustManager trustManager = trustManagers[0];
    if (trustManager instanceof X509TrustManager) {
        return (X509TrustManager) trustManager;
    }
    throw new IllegalStateException("'" + trustManager + "' is not a X509TrustManager");
}


private static TrustManagerFactory systemTrustManagerFactory() {
    try {
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init((KeyStore) null);
        return tmf;
    } catch (NoSuchAlgorithmException | KeyStoreException e) {
        throw new IllegalStateException("Can't load default trust manager", e);
    }
}
```

`TrustManagerFactory.getDefaultAlgorithm()` ne renverra que `PKIX` car c'est le 
seul algorithme utilisé par SSL. Toutefois des _algorithmes_ spécifiques peuvent 
être chargées, comme par exemple sur une JVM Sun/Oracle `SunX509` (ce qui ne sera bien 
évidement pas disponible sur IBM J9 ou sur Android. En revanche ces implémentations
sont toutes du type `X509TrustManager`.

À noter aussi le coté très générique cette API fait que `TrustManager.getTrustManagers()` 
renvoie un tableau de `TrustManager` pour chaque _type_ de gestion de confiance.
La javadoc:

> ```
> public final TrustManager[] getTrustManagers()
>
> Returns one trust manager for each type of trust material.
>
> Returns:
>     the trust managers
> Throws:
>     IllegalStateException - if the factory is not initialized.
> ```

Dans les faits jusqu'à aujourd'hui PKIX / X509 est le seul type possible pour une 
connexion TLS. Et la factory de la JVM ne crée qu'une seule instance de trust 
manager de type `X509Trustmanager`.


Bien que cela fonctionne et que la sécurité ait été raffinée la sécurité est 
toujours désactivée pour les certificats auto-signés. C'est acceptable pour 
du test mais si le code de production doit parler à des serveurs dont le 
certificat est auto-signé alors il est crucial de vérifier ce certificat
pour accorder la confiance au tiers.

À noter que ce code peut-être étendu pour aller plus loin dans la vérification 
du certificat auto-signé.

```java
if (isSelfSigned(chain)) {
    verifyMoreStuff(chain);
}
```


## Comment vérifier proprement des certificats auto-signés ?

Que faire si le code de production doit faire confiance à un serveur dont le 
certificat est auto-signé ?

Dans le cas d'un certificat auto-signé, la JVM n'est pas capable d'accorder 
de la confiance à ce certificat parce que aucune autorité de certification 
(les _CA_) n'a signé / émis ce dit certificat. Pour remédier à ça il faut 
_installer_ ce certificat.

Avant de l'installer toutefois, il faut le récupérer.

### Récupération du certificat auto-signé

À l'établissement de la connexion TLS, plus précisément durant la phase de 
négociation, le serveur envoie ses certificats.

Il est possible de les récupérer au format `PEM` avec `openssl`.

```sh
echo -n | \
  openssl s_client -prexit -connect host:port 2>&1 | \
  openssl x509 -outform pem \
  > certificate-host.pem
```

On indique au client ssl de `openssl` d'établir la connexion sur `host:port` 
puis le résultat est passé à la commande `x509` pour décoder le certificat 
(à la norme x509) afin de l'extraire sous la forme du format PEM.

On peut également afficher dans la console une représentation lisible par 
les humains :

```sh
echo -n | \
  openssl s_client -connect host:port 2>&1 | \
  openssl x509 -text
```

Pour lire le contenu du certificat stocké au format PEM on peut soit utiliser `openssl` 
soit `keytool` l'outils de la JVM.

```sh
keytool -printcert -file certificate-host.pem
openssl x509 -inform pem -in certificate-host.pem -text
```

### Utilisation du certificat autosigné sur la JVM

#### En installant le certificat dans le _cacerts_ de la JVM

La JVM vient avec un fichier `cacerts` qui représente les _certificats des autorités 
de certification_. Un certificat auto-signé n'a pas été signé (émis) par une de 
ces autorités, mais étant donné qu'il se signe lui-même, il est possible de 
l'installer dans ce keystore `cacerts`. Cela se fait avec l'outil `keytool` ; en 
fonction des permissions il faudra passer cette commande avec `sudo`. Le mot 
de passe par défaut du keystore de la JVM est `changeit`.

```sh
keytool -import \
        -alias wiremock \
        -file wiremock.pem \
        -keystore $JAVA_HOME/jre/lib/security/cacerts
```

Au préalable le certificat `wiremock.pem` (au format **PEM** donc) a été extrait 
d'un serveur wiremock. Cette commande l'importera avec l'alias `wiremock` dans 
le _keystore_ `cacerts` (fichier du JRE). 

> Il également est possible de regarder le contenu du store `cacerts` :
> 
> ```sh
> keytool -list -keystore $JAVA_HOME/jre/lib/security/cacerts
> ```
> 
> Après on importation on y retrouvera le certificat `wiremock` à coté de 
> ceux de Verisign, Digital Certs, Geo Trust, etc.

Une fois cela fait, le code suivant se connectera sans problème au serveur 
wiremock ayant ce certificat auto-signé.

```java
new OkHttpClient.Builder()
            .hostnameVerifier(allowAllHostNames())
            .build()
            .newCall(new Request.Builder().get()
                                          .url("https://localhost:8443")
                                          .build())
            .execute();
```

À noter que dans ce cas il y a toujours besoin d'un _hostname verifier_ car le 
certificat de wiremock ne permet pas de valider que le hostname _localhost_ ou 
de ses IPs associées correspond à ce certificat ([RFC 2818](https://tools.ietf.org/html/rfc2818#section-3.1)).

Quoiqu'il en soit cette procédure demande une modification de la configuration de 
l'installation de JVM. C'est pénible sur un poste de dévelopeur, c'est pénible sur 
le serveur de CI. Il y a moyen de mieux faire.



#### En utilisant un truststore alternatif

Avec cette approche un truststore alternatif est créé avec le même `keytool` :

À noter que le **certificat** au format `PEM` sera stockée dans un **key** store. 
L'extension `jks` vient du type de keystore, et correspond à Java Key Store.

```sh
keytool -import \
        -alias wiremock \
        -file wiremock.pem \
        -keystore ./wiremock-truststore.jks
```

Le certificat est toujours au format PEM et sera stocké dans un fichier  
`wiremock-truststore.jks` de type `jks` (pour Java Key Store).

> Plutôt que de rentrer _interractivement_ le mot de passe, en ajoutant 
> `-noprompt` et `-storepass <password>` on peut créer ce keystore sans 
> interaction.

```sh
keytool -import \
        -noprompt \
        -storepass changeit \
        -alias wiremock \
        -file wiremock.pem \
        -keystore ./wiremock-truststore.jks
```


Ensuite il faut lancer le programme java en passant les options 

* `-Djavax.net.ssl.trustStore=./wiremock-truststore.jks`
* `-Djavax.net.ssl.trustStorePassword=changeit`

```sh
java -Djavax.net.ssl.trustStore=./wiremock-truststore.jks \
     -Djavax.net.ssl.trustStorePassword=changeit \
     OkSSLConnect localhost 8443
```

`OkSSLConnect` est le programme sensé établir la connexion au serveur wiremock, 
c'est le code OkHttp vu plus haut main dans un `main` qui prend en paramètre le 
hostname et le port. S'il n'y a pas d'erreur SSL, alors le truststore alternatif 
contenant le certificat auto-signé a bien été utilisé.

En revanche si le programme doit se connecter sur un serveur ayant un certificat 
auto-signé ou sur un autre serveur ayant lui une chaine de certificats signés 
par des autorités reconnues, par exemple sur google.com, le programme lèvera 
une `SSLHandshakeException`.

```sh
java -Djavax.net.ssl.trustStore=./wiremock-truststore.jks \
     -Djavax.net.ssl.trustStorePassword=changeit \
     OkSSLConnect google.com 443
```

Sans le truststore `java OkSSLConnect google.com 443`, la connexion est établie 
avec succès.

Cette approche n'est donc pas non plus sans défaut, car les options de la JVM changent 
le truststore global de cette instance de la JVM. Cette approche à les même défaut 
que d'importer un certificat, il faut configurer le démarrage de la JVM avec ces options
et en plus de ça activer cette propriété limite la connectivité à d'autre serveur
(par exemple un plugin du système de build qui va se connecter sur l'API de GitHub). 
Cette approche n'est probablement pas une solution acceptable. 

#### En utilisant programmatiquement le certificat auto-signé

##### À partir d'un truststore JKS

Pour commencer on peut commencer par utiliser le truststore déjà créé par 
`keytool`. Le code qui suit est séparé en plusieurs responsabilités : 

* charger la factory de `TrustManager`, par défaut l'algorithme choisi est 
  [`PKIX`](https://docs.oracle.com/javase/8/docs/technotes/guides/security/StandardNames.html#TrustManagerFactory)
* charger le truststore, par défaut `KeyStore.getDefauktType()` retourne 
  `jks` <sup>[[1]](https://docs.oracle.com/javase/8/docs/technotes/guides/security/StandardNames.html#KeyStore)
  [[2]](https://docs.oracle.com/javase/8/docs/api/java/security/KeyStore.html#getDefaultType--)</sup>.
* construire un nouveau trust manager à partir des données du truststore

```java
public static X509TrustManager trustManagerFor(KeyStore keyStore) {
    TrustManagerFactory tmf = trustManagerFactoryFor(keyStore);

    TrustManager[] trustManagers = tmf.getTrustManagers();
    if (trustManagers.length != 1) {
        throw new IllegalStateException("Unexpected number of trust managers:"
                                                + Arrays.toString(trustManagers));
    }
    TrustManager trustManager = trustManagers[0];
    if (trustManager instanceof X509TrustManager) {
        return (X509TrustManager) trustManager;
    }
    throw new IllegalStateException("'" + trustManager + "' is not a X509TrustManager");
}


public static TrustManagerFactory trustManagerFactoryFor(KeyStore keyStore) {
    try {
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(keyStore);
        return tmf;
    } catch (KeyStoreException | NoSuchAlgorithmException e) {
        throw new IllegalStateException("Can't load trust manager for keystore : " + keyStore, e);
    }
}


public static KeyStore readJavaKeyStore(Path javaKeyStorePath, String password) {
    try (InputStream inputStream = new BufferedInputStream(Files.newInputStream(javaKeyStorePath))) {
        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        ks.load(inputStream, password.toCharArray());
        return ks;
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    } catch (CertificateException | NoSuchAlgorithmException | KeyStoreException e) {
        throw new IllegalStateException(e);
    }
}
```

Enfin il faut initialiser le client OkHttp avec la socket factory

```java
X509TrustManager trustManager = trustManagerFor(readJavaKeyStore(Paths.get("./wiremock-truststore.jks"), "changeit"));
new OkHttpClient.Builder()
        .sslSocketFactory(sslContext(null, new TrustManager[]{trustManager}).getSocketFactory(),
                          trustManager)
        .hostnameVerifier(allowAllHostNames())
        .build()
        .newCall(new Request.Builder().get()
                                        .url("https://localhost:8443")
                                        .build())
        .execute();
```

Avec ce contexte on peut initialiser la majeure partie des clients HTTP.

##### À partir du certificat au format `PEM`

Le code suivant va créer un keystore en mémoire qui va accueillir le certificat 
X.509 (c'est à dire le certificat extrait depuis la commande `openssl x509 -outform pem`).

```java
public static KeyStore makeJavaKeyStore(Path certificatePath) {
    try (BufferedInputStream bis = new BufferedInputStream(Files.newInputStream(certificatePath))) {
        CertificateFactory cf = CertificateFactory.getInstance("X.509");

        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        ks.load(null, null);
        int certificate_counter = 0;
        for (X509Certificate certificate : (Collection<X509Certificate>) cf.generateCertificates(bis)) {
            ks.setCertificateEntry("cert_" + certificate_counter++, certificate);
        }

        return ks;
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    } catch (CertificateException e) {
        throw new IllegalStateException("Can't load certificate : " + certificatePath, e);
    } catch (KeyStoreException | NoSuchAlgorithmException e) {
        throw new IllegalStateException("Can't create the internal keystore for certificate : " + certificatePath, e);
    }
}
```

Ce bout de code lit un fichier de certificat X509 et importe le ou les certificats
dans le `KeyStore` créé en mémoire.

--------------------------------------------------------------------------------

**Pour rappel :**

La javadoc de la méthode [`CertificateFactory.generateCertificate(InputStream)`](https://docs.oracle.com/javase/8/docs/api/java/security/cert/CertificateFactory.html#generateCertificate-java.io.InputStream-) 
indique précisément que le format supporté doit être **X.509** 
* au format `PEM`, c'est à dire le fichier contiens les balises 
    `-----BEGIN CERTIFICATE-----` et `-----END CERTIFICATE-----` avec une payload 
    ASCII encodée en _base 64_
* au format `DER` qui en est la représentation binaire (qu'on peut obtenir avec 
    `openssl x509 -in wiremock.pem -outform der > wiremock.der`).
 
> In the case of a certificate factory for X.509 certificates, the certificate 
> provided in inStream must be DER-encoded and may be supplied in binary or 
> printable (Base64) encoding. If the certificate is provided in Base64 encoding, 
> it must be bounded at the beginning by `-----BEGIN CERTIFICATE-----`, and must be 
> bounded at the end by `-----END CERTIFICATE-----`.

Ensuite il suffira de créer un trust manager avec le `KeyStore` créé par cette méthode :

```java
X509TrustManager trustManager = trustManagerFor(makeJavaKeyStore(Paths.get("./wiremock.pem")));
new OkHttpClient.Builder()
        .sslSocketFactory(sslContext(null, new TrustManager[]{trustManager}).getSocketFactory(),
                          trustManager)
        .hostnameVerifier(allowAllHostNames())
        .build()
        .newCall(new Request.Builder().get()
                                        .url("https://localhost:8443")
                                        .build())
        .execute();
```

--------------------------------------------------------------------------------

### En utilisant à la fois la chaine de confiance existante et le certificat auto-signé

Si le client HTTPS doit se connecter à la fois à des tiers ayant une chaine de 
confiance remontant à une autorité connue et à un ou des tiers ayant un certificat
auto-signé.

L'idée est simple, on peut fabriquer un trust manager composite qui va déléguer 
la validation aux trust managers configurés.

```java
public class CompositeX509TrustManager implements X509TrustManager {
    private final List<X509TrustManager> trustManagers;

    public CompositeX509TrustManager(X509TrustManager... trustManagers) {
        this.trustManagers = Arrays.asList(trustManagers);
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        new MultiException<>(new CertificateException("This certification chain couldn't be trusted"))
                .collectFrom(trustManagers.stream(),
                             trustManager -> trustManager.checkClientTrusted(chain, authType))
                .scream(UNLESS_ANY_SUCCESS);
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        new MultiException<>(new CertificateException("This certification chain couldn't be trusted"))
                .collectFrom(trustManagers.stream(),
                             trustManager -> trustManager.checkServerTrusted(chain, authType))
                .scream(UNLESS_ANY_SUCCESS);
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return trustManagers.stream()
                            .map(X509TrustManager::getAcceptedIssuers)
                            .flatMap(Arrays::stream)
                            .toArray(X509Certificate[]::new);
    }
}
```

`MultiException` est un petit utilitaire qui me permet de collecter plusieurs 
exceptions remontées par une variété d'appels, et de ne lever qu'une seule 
exception (parente), ce mécanisme utilise `Throwable.addSuppressed` ajouté 
en Java 1.7 pour supporter les blocs _try-with-resources_.

```java
public class MultiException<E extends Exception> {
    private final E parent;
    private boolean successMarker = false;

    public MultiException(E parent, Exception... exceptions) {
        this.parent = parent;
        Arrays.stream(exceptions).forEach(parent::addSuppressed);
    }

    public <T> MultiException<E> collectFrom(Stream<T> stream, ThrowingConsumer<T> invocation) {
        stream.forEach(t -> collect(t, invocation).ifPresent(parent::addSuppressed));
        return this;
    }

    private <T> Optional<Exception> collect(T type, ThrowingConsumer<T> throwing) {
        try {
            throwing.accept(type);

            successMarker = true;
            return Optional.empty();
        } catch (Exception e) {
            return Optional.of(e);
        }
    }

    public void scream(Mode mode) throws E {
        if (Mode.UNLESS_ANY_SUCCESS == mode && successMarker) {
            return;
        }
        if (parent.getSuppressed().length > 0) {
            throw parent;
        }
    }

    @FunctionalInterface
    public interface ThrowingConsumer<T> {
        void accept(T type) throws Exception;
    }

    public enum Mode {
        UNLESS_ANY_SUCCESS,
        ANY_FAILURE
    }
}
```

Ce gestionnaire composite s'utilisera de cette façon :

```java
X509TrustManager compositeTrustManager = new CompositeX509TrustManager(
        trustManagerFor(makeJavaKeyStore(Paths.get("./wiremock.pem"))),
        systemTrustManager());
OkHttpClient okHttpClient = httpClient(sslContext(null,
                                                  new TrustManager[]{compositeTrustManager}),
                                        compositeTrustManager)
        .newBuilder()
        .hostnameVerifier(allowAllHostname())
        .build();
```

Ce client pourra exécuter sans problèmes des requêtes sur des serveurs dont les autorités
de certifications sont connus et sur des serveurs ayant une chaine de certification
plus obscure.


## Coté serveur

On a vu le coté client, mais se baser sur le certificat de wiremock, n'est 
peut-être pas le plus correct d'un point de vue test.


### Génération du certificat auto-signé avec `keytool`

Créons notre propre certificat auto-signé : 

```sh
keytool -genkey \
        -keyalg RSA \
        -alias bric3 \
        -keystore bric3.jks \
        -storepass the_password \
        -validity 360 \
        -keysize 2048
```

`keytool` va nous poser des questions pour remplir successivement ces différents
attributs :

* `CN` (**C**ommon **N**ame)
* `OU` (**O**rganizational **U**nit)
* `O` (**O**rganization)
* `L` (**L**ocality)
* `ST` (**ST**ate)
* `C` (**C**ountry)

et enfin `keytool` finira par le password du certificat, à ne pas confondre 
avec le password du keystore. On peut rendre la génération non interactive en 
donnant les options : 

* `-keypass password`
* `-dname 'CN=Brice Duhteil, OU=Arkey, O=Arkey, L=Paris, ST=France, C=FR'`

> `dname` correspond à **D**istinguished **N**ames

Enfin ce certificat a le même problème que celui qui vient avec wiremock,
car il demande de modifier le hostname verifier ([RFC 2818](https://tools.ietf.org/html/rfc2818#section-3.1)). 
Ce problème peut être corrigé en ajoutant une section [`SAN` (**S**ubject 
**A**lternative **N**ames)](https://tools.ietf.org/html/rfc5280#section-4.2.1.6)
qui peut notamment contenir des noms DNS et des adresses IP. Avec
`keytool` il faut passer l'option `-ext` et passer les options `dns` ou `ip` :

```
-ext SAN=dns:domain.com,dns:localhost,ip:127.0.0.1
```

Par exemple si je veux indiquer que ce certificat est valide pour les serveurs 

* `blog.arkey.pro`
* `blog`
* `127.0.0.1`
* `::1`

```sh
keytool -genkey \
        -keyalg RSA \
        -alias bric3 \
        -keystore bric3.jks \
        -storepass the_password \
        -validity 360 \
        -keysize 2048 \
        -keypass the_password \
        -dname 'CN=Brice Duhteil, OU=Arkey, O=Arkey, L=Paris, ST=France, C=FR' \
        -ext 'SAN=dns:blog.arkey.fr,dns:blog,dns:localhost,ip:127.0.0.1,ip:::1'
```

--------------------------------------------------------------------------------

**À noter #1:**

1.  `keytool` génère le certificat et le stocke directement dans le **J**ava 
     **K**ey **S**tore
2.  wiremock ne permet de configurer qu'un seul mot de passe du certificat, à la 
    fois pour la clé du certificat et pour le **J**ava **K**ey **S**tore ; à la 
    création il faut donc absolument utiliser même mot de passe pour le JKS et 
    le certificat e.g. : `-storepass the_password` et `-keypass the_password`.

**À noter #2:**

`keytool` valide l'entrée DNS, mais ne gère pas tous les caractères possibles
d'un domaine, pour cette raison il est préférable d'utiliser `openssl` ou équivalent
pour générer ces certificats. Une partie intéressante de la spécification PKIX / 
X509 est l'extension _Subject Alt Names_ du format X509 version 3; 
elle permet de donner d'indiquer les _noms_ de serveurs pour les quels ce certificat 
a été émis (plutôt que le nom renseigné dans l'attribut _Common Name_). 
Un intérêt de cet attribut est qu'il est également possible de donner des noms ayant un
[wildcards](https://tools.ietf.org/html/rfc5280#section-4.2.1.6), ceci dit la logique du client
n'est pas couverte dans cette RFC.

> Finally, the semantics of subject alternative names that include
> wildcard characters (e.g., as a placeholder for a set of names) are
> not addressed by this specification.  Applications with specific
> requirements MAY use such names, but they must define the semantics.

Par exemple le certificat de **google.com** est configuré avec des domaines étant 
préfixés par un wildcard:

```sh
echo -n | openssl s_client -showcerts -connect google.com:443 2>&1 | openssl x509 -text
```

```
X509v3 Subject Alternative Name: 
    DNS:*.google.com, DNS:*.android.com, DNS:*.appengine.google.com, DNS:*.cloud.google.com, DNS:*.db833953.google.cn, DNS:*.g.co, DNS:*.gcp.gvt2.com, DNS:*.google-analytics.com, DNS:*.google.ca, DNS:*.google.cl, DNS:*.google.co.in, DNS:*.google.co.jp, DNS:*.google.co.uk, DNS:*.google.com.ar, DNS:*.google.com.au, DNS:*.google.com.br, DNS:*.google.com.co, DNS:*.google.com.mx, DNS:*.google.com.tr, DNS:*.google.com.vn, DNS:*.google.de, DNS:*.google.es, DNS:*.google.fr, DNS:*.google.hu, DNS:*.google.it, DNS:*.google.nl, DNS:*.google.pl, DNS:*.google.pt, DNS:*.googleadapis.com, DNS:*.googleapis.cn, DNS:*.googlecommerce.com, DNS:*.googlevideo.com, DNS:*.gstatic.cn, DNS:*.gstatic.com, DNS:*.gvt1.com, DNS:*.gvt2.com, DNS:*.metric.gstatic.com, DNS:*.urchin.com, DNS:*.url.google.com, DNS:*.youtube-nocookie.com, DNS:*.youtube.com, DNS:*.youtubeeducation.com, DNS:*.yt.be, DNS:*.ytimg.com, DNS:android.clients.google.com, DNS:android.com, DNS:developer.android.google.cn, DNS:developers.android.google.cn, DNS:g.co, DNS:goo.gl, DNS:google-analytics.com, DNS:google.com, DNS:googlecommerce.com, DNS:source.android.google.cn, DNS:urchin.com, DNS:www.goo.gl, DNS:youtu.be, DNS:youtube.com, DNS:youtubeeducation.com, DNS:yt.be
```

--------------------------------------------------------------------------------

### Génération du certificat auto-signé avec `openssl`

`keytool` c'est bien, mais l'outillage de référence est quand même le couteau 
suisse openssl.

#### Sous-section uniquement pour `openssl`

Pour générer un certificat auto-signé il faut en réalité plusieurs étapes

1. Générer une clé privée pour le domaine

    ```sh
    openssl genrsa \
        -out bric3-private.key \
        2048
    ```

    Cette commande créé un clé privée de 2048 bit en utilisant l'algorithme RSA.
    Cette clé n'est pas protégé par mot de passe (option `-des3`).

2. Faire la demande d'un certificat (façon non-interactive)

    ```sh
    openssl req \
        -new \
        -outform pem \
        -out bric3-self.csr \
        -keyform pem \
        -key bric3-private.key \
        -sha256 \
        -config <(cat <<-EOF

    [req]
    prompt = no
    req_extensions = bric3_req_ext
    distinguished_name = dn
    
    [dn]
    CN=Brice Dutheil
    O=Arkey
    OU=Arkey
    L=Paris
    ST=France
    C=FR

    [bric3_req_ext]
    subjectAltName = @alt_names

    [alt_names]
    DNS.1 = localhost
    DNS.2 = arkey.fr
    DNS.3 = *.arkey.fr
    DNS.4 = arkey.pro
    DNS.5 = *.arkey.pro
    DNS.6 = blog
    IP.1 = 127.0.0.1
    IP.2 = ::1

    EOF
    )
    ```

    Ce demande génère un fichier CSR (**C**ertificate **S**ign **R**equest) au format PEM.
    Il prend la clé privé du propriétaire des serveurs au format PEM. Les informations qui 
    concernent la configuration de l'émission du CSR sont indiquées dans un fichier de config 
    (dans cette commande passée via un stream `<(cat <<-MARKER ... MARKER)`). 
    
    On y retrouve une section `[req]`, indiquant le mode non interactif `prompt = no`, 
    le lien vers la section du **D**istinguished **N**ame `distinguished_name = dn`, 
    l'emplacement de l'extension portant sur les le **S**ubject **A**lt **N**ame 
    `req_extensions = bric3_req_ext`.

    La section`[dn]` contiens ce qui compose le DN, le **C**ommon **N**ame, etc. 
    
    La section des noms alternatifs aura les différentes entrées possibles, de type `DNS`,
    de type `IP`, etc.

    Enfin à noter que sans le paramètre `req_extensions = bric3_req_ext`, il aurait 
    fallu passer l'option en ligne de commande `-requexts bric3_req_ext`).

    Pour plus d'info sur la commande `req` et sa configuration, il faut parcourir la page 
    [man (branche master)](https://www.openssl.org/docs/manmaster/man1/req.html).


3. Signer la requête pour générer le certificat

    ```sh
    openssl x509 \
        -req \
        -days 3650 \
        -inform pem \
        -in bric3-self.csr \
        -signkey bric3-private.key \
        -outform pem \
        -out bric3-self.pem \
        -extensions bric3_ext \
        -extfile <(cat <<-EOF
    [bric3_ext]
    subjectAltName = @alt_names

    [alt_names]
    DNS.1 = localhost
    DNS.2 = arkey.fr
    DNS.3 = *.arkey.fr
    DNS.4 = arkey.pro
    DNS.5 = *.arkey.pro
    DNS.6 = blog
    IP.1 = 127.0.0.1
    IP.2 = ::1
    EOF
    )
    ```

    Cette commande `x509` génère donc un certificat X509 depuis la requête de 
    signature (`-req`). En entrée il y a donc la requête `-in bric3-self.csr` et 
    comme il s'agit d'un certificat auto-signé il faut donner sa propre clé 
    privée `-signkey bric3-private.key`, (autrement il s'agirait de la clé 
    privée de l'autorité de certification). Le certificat émis sera valide pour 
    10 ans (`-days 3650`).

    Cette commande ne récupère pas les extensions depuis la requête de signature 
    de certificat, par conséquent il faut lui donner l'info dans un fichier de 
    configuration ou par un stream `-extfile <(cat <<-EOF ... EOF)`, il faut 
    également passer le nom de la section, ici `-extensions bric3_ext`.

    Si tout est bon un certificat `bric3-self.pem` est généré.

    Pour plus d'info sur la commande `x509` et sa configuration, il faut parcourir 
    la page [man (branche master)](https://www.openssl.org/docs/manmaster/man1/x509.html).

La configuration est bien entendu plus compliqué lorsqu'il faut faire les étapes 
complètes avec une _autorité de certification_ et une chaine de certificats plus 
élaborée.

Ces trois étapes peuvent être réduite en une seule pour les certificats auto-signés.

```sh
openssl req \
    -new \
    -nodes \
    -sha256 \
    -newkey rsa:2048 \
    -keyform pem \
    -keyout bric3-openssl.key \
    -x509 \
    -days 3650 \
    -outform pem \
    -out bric3-openssl.crt \
    -config <(cat <<-EOF
[req]
prompt = no
distinguished_name = dn
x509_extensions = bric3_ext

[dn]
CN=Brice Dutheil
O=Arkey
OU=Arkey
L=Paris
ST=France
C=FR

[bric3_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = arkey.fr
DNS.3 = *.arkey.fr
DNS.4 = arkey.pro
DNS.5 = *.arkey.pro
DNS.6 = blog
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)
```

La commande est `req` 

- avec l'option `-newkey rsa:2048` qui permet de générer une clé RSA de longueur 2048.
    Cette clé sera enregistré dans le fichier `bric3-openssl.key` au format PEM.
- avec l'option `-x509` qui indique que le résultat de sortie ne sera pas
    une requête de signature mais le certificat signé (au format X509).
    Celui-ci aura une validité de 10 ans `-days 3650` et sera enregistré dans le fichier
    `bric3-openssl.crt` au format PEM. Comme l'option `-x509` est activée, il faut utiliser
    dans notre configuration le paramètre `x509_extensions = bric3_ext` pour indiquer 
    la section correspondante (au lieu de `req_extensions`).

--------------------------------------------------------------------------------

À noter que `subjectAltName = @alt_names` permet de lister _verticalement_ une liste de 
valeurs dans la section `alt_names`, e.g.

```
[bric3_ext]
subjectAltName = DNS.1 : localhost, DNS.3 : arkey.fr, DNS.3 : *.arkey.fr, DNS.4 : arkey.pro, DNS.5 : *.arkey.pro, DNS.6 : blog, IP.1 : 127.0.0.1, IP.2 : ::1
```

est équivalent à

```
[bric3_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = arkey.fr
DNS.3 = *.arkey.fr
DNS.4 = arkey.pro
DNS.5 = *.arkey.pro
DNS.6 = blog
IP.1 = 127.0.0.1
IP.2 = ::1
```

Il y a quelques différences de syntaxe
- utilisation de deux points `:` avec d'un coté le type de nom alternatif 
    (`IP`, `DNS`, etc.)  pour la liste.
- utilisation d'une notation _indexée_ post-fixée au type du nom alternatif 
    pour la liste dans une section (`DNS.1`, `DNS.2`, etc.).

--------------------------------------------------------------------------------

Enfin pour utiliser sur la JVM ce certificat et cette clé il faut les packager 
ensemble. Les librairies standards de la JVM peuvent charger un **J**ava **K**ey 
**S**tore ou un fichier P12 (**PKCS12**).


```sh
openssl pkcs12 \
    -export \
    -in bric3-openssl.crt \
    -inkey bric3-openssl.key \
    -passout pass:cadeau \
    -out bric3.p12
```

Pour créer un java keystore depuis ce fichier PKCS12 :

```sh
keytool -importkeystore \
        -srckeystore bric3.p12 \
        -srcstoretype PKCS12 \
        -srcstorepass cadeau \
        -deststorepass the_password \
        -destkeypass the_password \
        -destkeystore bric3-openssl.jks
```


### Chargement du certificat dans la JVM

Pour utiliser ce certificat il faut le charger dans wiremock et dans le client : 

```java
@Rule
public WireMockRule wireMockRule = new WireMockRule(wireMockConfig().dynamicPort()
                                                                    .keystorePath("./bric3.jks")
                                                                    .keystorePassword("the_password")
                                                                    .dynamicHttpsPort());

@Test
public void my_precious_self_signed_certificate() throws IOException {
    X509TrustManager compositeTrustManager = new CompositeX509TrustManager(
            trustManagerFor(readJavaKeyStore(Paths.get("./bric3.jks"), "the_password")),
            systemTrustManager());
    OkHttpClient okHttpClient = httpClient(sslContext(null,
                                                        new TrustManager[]{compositeTrustManager}),
                                            compositeTrustManager)
            .newBuilder()
            .build();
    try (Response response = okHttpClient.newCall(new Request.Builder().get()
                                                                       .url(format("https://%s:%d",
                                                                                   "localhost",
                                                                                   wireMockRule.httpsPort()))
                                                                       .build())
                                         .execute()) {
        // successfully established connection
    }
}
```

Wiremock utilise Jetty sous le capot et qui ne permet pas d'utiliser un fichier p12.
Bien que toutes les [implémentations de la JVM](https://docs.oracle.com/javase/8/docs/technotes/guides/security/StandardNames.html#impl) 
sont tenues d'implémenter le chargement de keystore au format PKCS12, Jetty ne 
[supporte pas directement les fichiers p12](https://wiki.eclipse.org/Jetty/Howto/Configure_SSL#Loading_Keys_and_Certificates_via_PKCS12),
il faut donc convertir le fichier p12 en **J**ava **K**ey **S**tore.


## Pour conclure

Dans cet article on a pu découvrir comment gérer un certificat auto-signé en java,
et comment créer nos propres certificats auto-signés à l'aide d'outils quasi 
standard. À travers les exemples on a pu découvrir quelques classes qui composent
les fonctionnalités de sécurité de la JVM.

Il y a plus de choses à approfondir avec TLS, par exemple construire sa propre 
autorité de certification et gérer la vérification de cette chaine de certificat,
ou encore l'authentification mutuelle (le client authentifie le serveur et le 
serveur authentifie le client). Ou encore comment la librairie 
[BouncyCastle](https://www.bouncycastle.org/java.html) s'intègre dans ce mécanisme.

### Versions

Cet article a été élaboré avec les versions suivantes

* Java 1.8.0u144
* okhttp 3.9.0
* wiremock 2.8.0
* High Sierra / OSX 10.13 / Darwin 17.0.0 / 17A405
* openssl => LibreSSL 2.2.7 (High Sierra vient avec LibreSSL)

### Quelques références

* https://www.openssl.org
* https://www.libressl.org
* http://wiki.cacert.org/FAQ/subjectAltName
* https://www.digitalocean.com/community/tutorials/how-to-create-a-ssl-certificate-on-apache-for-ubuntu-14-04
* https://tools.ietf.org/html/rfc5280
* https://tools.ietf.org/html/rfc2818
* https://tools.ietf.org/html/rfc5246
* https://docs.oracle.com/javase/8/docs/technotes/guides/security/index.html






{{< draftNotes >}}

https://security.stackexchange.com/questions/107240/how-to-read-certificate-chains-in-openssl
https://security.stackexchange.com/questions/72077/validating-an-ssl-certificate-chain-according-to-rfc-5280-am-i-understanding-th/72085#72085
https://security.stackexchange.com/questions/83372/what-is-the-difference-of-trustmanager-pkix-and-sunx509
https://www.digitalocean.com/community/tutorials/how-to-create-a-ssl-certificate-on-apache-for-ubuntu-14-04
http://blog.palominolabs.com/2011/10/18/java-2-way-tlsssl-client-certificates-and-pkcs12-vs-jks-keystores/index.html
https://typesafehub.github.io/ssl-config/CertificateGeneration.html
https://stackoverflow.com/a/33844921/48136

https://stackoverflow.com/questions/906402/how-to-import-an-existing-x509-certificate-and-private-key-in-java-keystore-to-u/8224863#8224863
http://blog.endpoint.com/2014/10/openssl-csr-with-alternative-names-one.html
https://security.stackexchange.com/a/166645/30540

https://security.stackexchange.com/questions/73156/whats-the-difference-between-x-509-and-pkcs7-certificate
http://apetec.com/support/GenerateSAN-CSR.htm
https://gist.github.com/jchandra74/36d5f8d0e11960dd8f80260801109ab0
https://www.pixelstech.net/article/1420427307-Different-types-of-keystore-in-Java----PKCS12

{{< /draftNotes >}}
