---
layout: post
title: Se connecter en java sur une URL HTTPS avec un certificat auto-signé
date: 2017-05-10
published: false
tags:
- ssl
- https
- java
- okhttp
- openssl
- libressl
- trustmanager
- certificate authority
- self-signed certificates
- auto-signé certificats
author: Brice Dutheil
---

Requirement, il faut écrire un test pour un service exposé en HTTPS. Le test utilisera un server HTTP mocké comme wiremock, mock-server, etc.
Celui-ci exposera un port HTTPS.

## En test

Tout part de wiremock en HTTPS, au premier usage du serveur de mock le client HTTP 
se plain d'une erreur SSL.

### Reproduire le problème

```java
public class WireMockSSLTest {
    @Rule
    public WireMockRule wireMock = new WireMockRule(wireMockConfig().dynamicPort()
                                                                    .dynamicHttpsPort());

    @Test
    public void ssl_poke() throws IOException {
        new OkHttpClient.Builder().build()
                                  .newCall(new Request.Builder().get()
                                                                .url("https://localhost:" + wireMock.httpsPort())
                                                                .build())
                                  .execute();
    }
}
```

Ce code lève l'exception suivante

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

Comment comprendre cette stacktrace : ce serveur expose un certificat, mais le client n'arrive pas à remonter la chaine des certificats jusqu'à une **autorité** connue pour le vérifier. **C'est un certificat auto-signé.**


### Fixer le problème du test

#### Faire confiance à tout le monde

Pour accepter ce certificat auto-signé, on peut par exemple configurer notre socket SSL pour accepter tous les certificats.


```java
public class WireMockSSLTest {
    @Rule
    public WireMockRule wireMock = new WireMockRule(wireMockConfig().dynamicPort()
                                                                    .dynamicHttpsPort());

    @Test
    public void ssl_poke() throws IOException {
        new OkHttpClient.Builder().sslSocketFactory(trustAllSslContext().getSocketFactory(),
                                                    TrustAllX509TrustManager.INSTANCE)
                                  .build()
                                  .newCall(new Request.Builder().get()
                                                                .url("https://localhost:" + wireMock.httpsPort())
                                                                .build())
                                  .execute();
    }
}
```

Pour faire ce code il faut créer un contexte SSL pour une connection de type **TLS**, et
passer un _trust manager_. Le role du trust manager est de vérifier si cette connection est 
fiable à partir de la chaine de certificat de cette connection.

```java
public static SSLContext trustAllSslContext() {
    try {
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null,
                        TrustAllX509TrustManager.ARRAY_INSTANCE,
                        null);
        return sslContext;
    } catch (NoSuchAlgorithmException | KeyManagementException e) {
        throw new IllegalStateException("Couldn't init TLS with trust all X509 manager", e);
    }
}
```

La javadoc de la méthode [`SSLContext#init`](https://docs.oracle.com/javase/8/docs/api/javax/net/ssl/SSLContext.html#init-javax.net.ssl.KeyManager:A-javax.net.ssl.TrustManager:A-java.security.SecureRandom-) indique que seul le premier élément du tableau sera utilisé, pour cette raison nous ne créons qu'un seul trust manager.

> ```
> javax.net.ssl.SSLContext
> public final void init(KeyManager[] km,
>                       TrustManager[] tm,
>                       SecureRandom random)
>                throws KeyManagementException
> ```
>
> Initializes this context. Either of the first two parameters may be null in which case the installed security providers will be searched for the highest priority implementation of the appropriate factory. Likewise, the secure random parameter may be null in which case the default implementation will be used.
>
> **Only the first instance** of a particular key and/or trust manager implementation type in the array is used. (For example, only the first javax.net.ssl.X509KeyManager in the array will be used.)
>
> Parameters:
>     km - the sources of authentication keys or null
>     tm - the sources of peer authentication trust decisions or null
>     random - the source of randomness for this generator or null
> Throws:
>    KeyManagementException - if this operation fails


Enfin la seule implémentation du `TrustManager` est le `X509TrustManager`, qu'il faut spécialiser pour tout accepter : le code ne vérifiera pas la chaine de certificats.

```java
public static class TrustAllX509TrustManager implements X509TrustManager {
    public static final X509TrustManager INSTANCE = new TrustAllX509TrustManager();
    public static final X509TrustManager[] ARRAY_INSTANCE = new X509TrustManager[]{INSTANCE};

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException { }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException { }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[0];
    }
}
```

Avec ça on peut imaginer que notre code fonctionne, et bien non, il y a toujours une erreur lors de l'accès à notre wiremock : 

```
javax.net.ssl.SSLPeerUnverifiedException: Hostname localhost not verified:
    certificate: sha256//W3v5TDAEE3dl4peiEwpwDKa1OZAna1ITgokQDz0rkQ=
    DN: CN=Tom Akehurst, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=Unknown
    subjectAltNames: []

	at okhttp3.internal.connection.RealConnection.connectTls(RealConnection.java:308)
	...
```

Tous les clients HTTPS ([RFC 2818](https://tools.ietf.org/html/rfc2818)) doivent en fait vérifier l'identité du serveur avec le hostname afin de prévenir les attaques _man-in-the-middle_ voir [§3.1 server identity](https://tools.ietf.org/html/rfc2818#section-3.1).

Le problème ici est que ce certificat autosigné généré par wiremock ne fournit pas de nom alternatifs `subjectAltNames`.

Avec le code équivalent avec du _vanilla_ Java : 

```java
// Autorise tous les certificats
HttpsURLConnection.setDefaultSSLSocketFactory(trustAllSslContext().getSocketFactory());
new URL("https://localhost:" + wireMock.httpsPort()).openConnection().connect();
```

Il faut ajouter un [`HostnameVerifier`](https://docs.oracle.com/javase/8/docs/api/javax/net/ssl/HostnameVerifier.html) qui ne vérifie rien, et de configurer `HttpsURLConnection` avant d'établir la connection :

```java
HostnameVerifier allHostsValid = (hostname, session) -> true;
HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
```

En appliquant le même `HostnameVerifier` au client OkHttp :

```java
public static HostnameVerifier allowAllHostNames() {
    return (hostname, sslSession) -> true;
}
```

```java
new OkHttpClient.Builder().sslSocketFactory(trustAllSslContext().getSocketFactory(),
                                            TrustAllX509TrustManager.INSTANCE)
                          .hostnameVerifier(allowAllHostNames())
                          .build()
                          .newCall(new Request.Builder().get()
                                                        .url("https://localhost:" + wireMock.httpsPort())
                                                        .build())
                          .execute();
```

Ce code fonctionnera, il est maintenant possible de se connecter à wiremock en HTTPS.

En revanche, cette configuration ne doit pas être utilisée sur du code de production, car ce la revient à désactiver la sécurité sur toutes les connections SSL. Il faudra donc prévoir un mécanisme de configuration de connection SSL dans le code de production pour conserver des réglages sains en prod et relaxer la sécurité pour le serveur de test.

À noter par exemple que cet exemple est pensé pour du back-end, mais ce sujet touche de près les applications mobile. Par exemple la [documentation Android](https://developer.android.com/training/articles/security-ssl.html#CommonHostnameProbs) explique très bien les soucis liés à la vérification du hostname.

#### Faire confiance aux certificats autosignés

Comment sait-on identifier un certificat auto-signé ? Lorsque OpenSSL se connecte sur le serveur HTTPS wiremock

> `s_client` est une commande de OpenSSL qui fait office de client SSL/TLS.

```sh
echo -n | \
        openssl s_client -connect localhost:8443 2>&1
```

Cette commande donne en retour plein de donnée intéressante :

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

La chaine de certificat avec, par certificat, la première ligne `s` qui indique le _sujet_ du certificat,
et une deuxième ligne `i` qui indique l'_issuer_ du certificat.

```
Certificate chain
 0 s:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
   i:/C=Unknown/ST=Unknown/L=Unknown/O=Unknown/OU=Unknown/CN=Tom Akehurst
```

Enfin la session SSL rappelle le status de la vérification

```
SSL-Session:
    Protocol  : TLSv1.2
    Cipher    : ECDHE-RSA-AES128-GCM-SHA256
    ...
    Verify return code: 18 (self signed certificate)
```

La vérification du certificat indique le code `18` et indique qu'il s'agit d'un certificat auto-signé. Plus précisement le [wiki openssl](https://wiki.openssl.org/index.php/Manual:Verify(1)) indique :

> **18 X509_V_ERR_DEPTH_ZERO_SELF_SIGNED_CERT**: self signed certificate

Une chaine avec une profondeur de 0 correspond en fait à un certificat non-signé

Il est possible d'écrire un trust manager capable de vérifier les chaines de certificats usuelles et à la fois les certificats auto-signés. L'idée est donc d'écrie un trust manager qui délègue au système les chaines de certificats classiques mais qui a comportement spécial pour les certificats auto-signés.


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

Il s'utilisera de la manière suivante : 

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
        TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        trustManagerFactory.init((KeyStore) null);
        return trustManagerFactory;
    } catch (NoSuchAlgorithmException | KeyStoreException e) {
        throw new IllegalStateException("Can't load default trust manager algorithm", e);
    }
}
```

```java
X509TrustManager trustManager = TrustSelfSignedX509TrustManager.wrap(systemTrustManager());
new OkHttpClient.Builder().sslSocketFactory(sslContext(null, new X509TrustManager[] { trustManager }).getSocketFactory(),
                                            trustManager)
                          .hostnameVerifier(allowAllHostname())
                          .build()
                          .newCall(new Request.Builder().get()
                                                        .url("https://localhost:" + wireMock.httpsPort())
                                                        .build())
                          .execute();
```


Bien que celà fonctionne la même mise en garde sur la mise en prod d'un tel code. Il n'est pas improbable que certains server n'expose qu'un certificat auto-signé. Il peut donc être intéréssant d'aller plus loin dans la vérification de ce certificat. Ce code peut donc être poussé pour vérfier le certificat.

```java
if (isSelfSigned(chain)) {
    return;
}
```


## Comment supporter des certificats auto-signés dans du code de production ?

Que faire si le code de production doit faire confiance à un serveur dont le certificat est auto-signé ?

Dans le cas d'un certificat auto-signé, la JVM n'est pas capable d'accorder de la confiance à ce certificat parce que aucune autorité de certification (les _CA_) n'a signé / émis ce dit certificat. Pour remédier à ça il faut _installer_ ce certificat.

Avant de l'installer toutefois, il faut le récupérer.

### Récupération du certificat auto-signé

À l'établissement de la connection TLS, plus précisement durant la phase de négociation, le serveur envoie ses certificats.

Il est possible de les récupérer au format `PEM` avec `openssl`.

```sh
echo -n | \
  /usr/local/opt/libressl/bin/openssl s_client -prexit -connect host:port 2>&1 | \
  /usr/local/opt/libressl/bin/openssl x509 \
  > certificate-host.pem
```

On indique au client ssl de `openssl` d'établir la connection sur `host:port` puis le résultat est passé à la commande `x509` pour décoder le certificat (à la norme x509) afin de l'extraire sous la forme du format PEM. On peut assui 

```sh
echo -n | \
  /usr/local/opt/libressl/bin/openssl s_client -connect host:port 2>&1 | \
  /usr/local/opt/libressl/bin/openssl x509 -text
```

Le format PEM étant encodé, il est possible de les _ouvrir_ avec soit `openssl` ou `keytool` l'outils de la JVM.

```sh
keytool -printcert -file certificate-host.pem
openssl x509 -in certificate-host.pem -text
```

### Utilisation du certificat autosigné sur la JVM

#### En installant le certificat dans le _cacerts_ de la JVM

La JVM vient avec un dossier `cacerts` qui représente les _certificats des autorités de certification_. Le certificat auto-signé n'a pas été signé / émis par une de ces autorités, mais étant donné qu'il se signe lui-même, il est possible de l'installer dans le répertoire de la JVM avec l'outils `keytool`. En fonction des permissions il faudra passer cette commande avec `sudo`. Le mot de passe par défaut du keystore de la JVM est `changeit`.

```sh
# Nous n'éxecuterons pas cette commande
keytool -import -alias wiremock -file wiremock.pem -keystore $JAVA_HOME/jre/lib/security/cacerts
```

En supposant le certificat d'un serveur wiremock ait été récupéré dans le fichier `wiremock.pem` (au format **PEM** donc), cette commande l'importera avec l'alias `wiremock` dans le _keystore_ `cacerts` (fichier du JRE). 

> Il également est possible de regarder le contenu du store `cacerts` :
> 
> ```sh
> keytool -list -keystore $JAVA_HOME/jre/lib/security/cacerts
> ```
> 
> On y retrouvera notre certificat `wiremock` à coté de ceux de Verisign, Digital Certs, Geo Trust, etc.

Une fois celà fait, le code suivant se connectera sans problème au serveur wiremock ayant ce certificat auto-signé.

```java
new OkHttpClient.Builder().hostnameVerifier(allowAllHostNames())
                          .build()
                          .newCall(new Request.Builder().get()
                                                        .url("https://localhost:8443")
                                                        .build())
                          .execute();
```

À noter que dans ce cas il y a toujours besoin d'un _hostname verifier_ car le certificat de wiremock ne permet pas de valider que le hostname _localhost_ ou de ses IPs associées correspond à ce certificat.

En revanche cette étape demande une modification de la configuration de l'installation de JVM. Il y a moyen de mieux faire.



#### En utilisant un truststore aternatif

Avec cette approche un truststore alternatif est créé avec le même `keytool` :

À noter que le **certificat** au format `PEM` sera stockée dans un **key** store. L'extension `jks` vient du type de keystore, et correspond à Java Key Store.

```sh
# Creates local truststore, the tool will ask for a password and if the certificate can be trusted
keytool -import -alias wiremock -file wiremock.pem -keystore ./wiremock-truststore.jks
```

Le certificat est toujours au format PEM et sera stocké dans un fichier keystore `wiremock-truststore.jks` de type `jks` (pour Java Key Store).

> Plutot que de rentrer _interractivement_ le mot de passe, en ajoutant `-noprompt` et `-storepass <password>` on peut créer ce keystore sans interation.

```sh
# Create the truststore without user interaction
keytool -import -noprompt -storepass changeit -alias wiremock -file wiremock.pem -keystore ./wiremock-truststore.jks
```


Ensuite il faut lancer le programme java en passant les options 

* `-Djavax.net.ssl.trustStore=./wiremock-truststore.jks`
* `-Djavax.net.ssl.trustStorePassword=changeit`

```sh
java -Djavax.net.ssl.trustStore=./wiremock-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit SSLConnect localhost 8443
```

`SSLConnect` est le programme sensé établir la connection au serveur wiremock, c'est le code OkHttp vu plus haut. S'il n'y a pas d'erreur SSL, alors le truststore alternatif contenant le certificat autosigné a bien été utilisé.


En revanche en gardant si un programme java doit se connecter à ce serveur alternatif, mais aussi à un autre site ayant lui des certificat d'autorités connues par exemple google, le programme lèvera une `SSLHandshakeException`

```sh
java -Djavax.net.ssl.trustStore=./wiremock-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit SSLConnect google.com 443
```

Sans le truststore `java SSLConnect google.com 443`, la connection est établie avec succès.

Cette approche n'est donc pas sans défaut, car les options de la JVM changent le truststore global de cette instance de la JVM, en fonction des besoins du programme ce ne sera peut-être pas une solution acceptable.



















---------------------------------------------------

https://security.stackexchange.com/questions/107240/how-to-read-certificate-chains-in-openssl
https://security.stackexchange.com/questions/72077/validating-an-ssl-certificate-chain-according-to-rfc-5280-am-i-understanding-th/72085#72085



Certificat autosigné, quand vous vos connectez, belle stack

```
javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
```

Utiliser un petit outils appelé `SSLPoke`,

https://gist.github.com/4ndrej/4547029

```java
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Establish a SSL connection to a host and port, writes a byte and
 * prints the response. See
 * http://confluence.atlassian.com/display/JIRA/Connecting+to+SSL+services
 */
public class SSLPoke {
    public static void main(String[] args) {
        if (args.length != 2) {
            System.out.println("Usage: "+SSLPoke.class.getName()+" <host> <port>");
            System.exit(1);
        }
        try {
            SSLSocketFactory sslsocketfactory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            SSLSocket sslsocket = (SSLSocket) sslsocketfactory.createSocket(args[0], Integer.parseInt(args[1]));

            InputStream in = sslsocket.getInputStream();
            OutputStream out = sslsocket.getOutputStream();

            // Write a test byte to get a reaction :)
            out.write(1);

            while (in.available() > 0) {
                System.out.print(in.read());
            }
            System.out.println("Successfully connected");

        } catch (Exception exception) {
            exception.printStackTrace();
        }
    }
}
```

```sh
java SSLPoke host port
```

Donc l'idée c'est de récupérer le certificat auto-signé du host

### Extraction du certificat

OSX / Sierra
JDK 1.8.0_121

```sh
brew install libressl
```



```sh
echo -n | \
  /usr/local/opt/libressl/bin/openssl s_client -prexit -connect host:port 2>&1 | \
  /usr/local/opt/libressl/bin/openssl x509 \
  > host.pem
```

For human readable details on this certificate :

```sh
echo -n | \
  /usr/local/opt/libressl/bin/openssl s_client -connect host:port 2>&1 | \
  /usr/local/opt/libressl/bin/openssl x509 -text
```



```sh
# To look again at the certificate
keytool -printcert -file certificate.pem
openssl x509 -in certificate.pem -text
```

### Utilisation du certificat autosigné avec la JVM

Nous ne voulons pas changer les paramètres de la JVM, par conséquent nous ne rajouterons pas les certificats dans le `cacerts` de la JVM.

```sh
# Nous n'éxecuterons pas cette commande
keytool -import -alias host -file host.pem -keystore $JAVA_HOME/jre/lib/security/cacerts
```

En revanche nous voulons créer un truststore alternatif, pour cela nous utilisons `keytool` un outils du JDK pour gérer
clés et certificats.

À noter que le **certificat** au format `pem` sera stocké dans un **key** store. L'extension `jks` vient du type de keystore, et correspond à Java Key Store.

```sh
# Creates local truststore, the tool will ask for a password and if the certificate can be trusted
keytool -import -alias host -file host.pem -keystore host-truststore.jks
```

Ce java keystore peut être créé sans interation de l'utilisateur dans le terminal

```sh
# Create the truststore without user interaction
keytool -import -trustcacerts -noprompt -storepass changeit -alias host -file host.pem -keystore host-truststore.jks
```


Maintenant essayons ce truststore en passant les options `-Djavax.net.ssl.trustStore=host-truststore.jks`
 `-Djavax.net.ssl.trustStorePassword=changeit` :

```sh
java -Djavax.net.ssl.trustStore=host-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit SSLPoke host port
```

Si SSLPoke retourne `Successfully connected`, alors le bon certificat a été utilisé



Si j'utilise ce truststore alternatif pour me connecter au serveur de google, `SSLPoke` va remonter une erreur, car ce keystore
ne contient pas les certificats racine de google.


```sh
# SSLPoke will use default JDK cacerts
$ java SSLPoke google.com 443
Successfully connected

# SSLPoke will use given trust store instead of JDK default
$ java -Djavax.net.ssl.trustStore=host-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit SSLPoke google.com 443
javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
...
```

Changer le trust store global de la JVM n'est peut-être pas la bonne idée si l'application dépends de services standards
dont les certificats sont déjà préinstallé. En revanche il est possible de charger et d'utiliser son propre truststore.

### Utilisation du certificat autosigné programmatiquement

L'idée est donc de configurer un contexte SSL dédié avec ce truststore. Ce code assume être le client d'un serveur.

```java
// Create a new SSL cotext that will initiate TLS Connections (TLS supports at this time version 1.0, 1.1, 1.2)
SSLContext sslContext = SSLContext.getInstance("TLS");

// Read the given trustStore (stored in a Java KeyStore format, JKS)
KeyStore ks = null;
try(InputStream inputStream = new BufferedInputStream(Files.newInputStream(Paths.get(javaKeyStore)))) {
    ks = KeyStore.getInstance("JKS");
    ks.load(inputStream,  "changeit".toCharArray());
}

// Create a new TrustManagerFactory and initialize it with certificates in the loaded keystore
TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(
        TrustManagerFactory.getDefaultAlgorithm() // Probably PKIX
);
// Load the keystore containing our certificates only
trustManagerFactory.init(ks);

// Initialize the context with the custom trust manager.
sslContext.init(null /* the private key to send to the server */,
                trustManagerFactory.getTrustManagers() /* mon gestionnaire de confiance */,
                null);
```

Avec ce contexte on peut initialiser la majeure partie des clients HTTP.



















### Other interesting commands


```sh
# to get the whole chain use -showcerts, then cat everything certificate in the pem file
echo -n | \
  /usr/local/opt/libressl/bin/openssl s_client -showcerts -connect host:port 2>&1 | \
  sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' \
  > host-chain.pem
# import the chain in the truststore
keytool -import -trustcacerts -noprompt -storepass changeit -alias host -file host-chain.pem -keystore host-chain-truststore.jks
```


Voir :

* http://www.programcreek.com/java-api-examples/index.php?api=java.security.KeyStore.Builder
* https://github.com/square/okhttp/blob/master/samples/guide/src/main/java/okhttp3/recipes/CustomTrust.java
* http://www.robinhowlett.com/blog/2016/01/05/everything-you-ever-wanted-to-know-about-ssl-but-were-afraid-to-ask/
* https://coderwall.com/p/psnkyq/converting-a-certificate-chain-and-key-into-a-java-keystore-for-ssl-on-puma-java
* https://www.calazan.com/how-to-convert-a-java-keystore-jks-to-pem-format/





### Other interesting informations

#### Certificates and Encodings

At its core an `X.509` certificate is a digital document that has been encoded and/or digitally signed according to RFC 5280.

In fact, the term X.509 certificate usually refers to the IETF’s PKIX Certificate and CRL Profile of the X.509 v3 certificate standard, as specified in RFC 5280, commonly referred to as PKIX for Public Key Infrastructure (X.509).

X509 File Extensions

The first thing we have to understand is what each type of file extension is.   There is a lot of confusion about what DER, PEM, CRT, and CER are and many have incorrectly said that they are all interchangeable.  While in certain cases some can be interchanged the best practice is to identify how your certificate is encoded and then label it correctly.  Correctly labeled certificates will be much easier to manipulat

Encodings (also used as extensions)

.DER = The DER extension is used for binary DER encoded certificates. These files may also bear the CER or the CRT extension.   Proper English usage would be “I have a DER encoded certificate” not “I have a DER certificate”.
.PEM = The PEM extension is used for different types of X.509v3 files which contain ASCII (Base64) armored data prefixed with a “—– BEGIN …” line.
Common Extensions

.CRT = The CRT extension is used for certificates. The certificates may be encoded as binary DER or as ASCII PEM. The CER and CRT extensions are nearly synonymous.  Most common among \*nix systems
CER = alternate form of .crt (Microsoft Convention) You can use MS to convert .crt to .cer (.both DER encoded .cer, or base64[PEM] encoded .cer)  The .cer file extension is also recognized by IE as a command to run a MS cryptoAPI command (specifically rundll32.exe cryptext.dll,CryptExtOpenCER) which displays a dialogue for importing and/or viewing certificate contents.
.KEY = The KEY extension is used both for public and private PKCS#8 keys. The keys may be encoded as binary DER or as ASCII PEM.
The only time CRT and CER can safely be interchanged is when the encoding type can be identical.  (ie  PEM encoded CRT = PEM encoded CER)

Common OpenSSL Certificate Manipulations

There are four basic types of certificate manipulations. View, Transform, Combination , and Extraction

View

Even though PEM encoded certificates are ASCII they are not human readable.  Here are some commands that will let you output the contents of a certificate in human readable form;

View PEM encoded certificate

Use the command that has the extension of your certificate replacing cert.xxx with the name of your certificate

openssl x509 -in cert.pem -text -noout
openssl x509 -in cert.cer -text -noout
openssl x509 -in cert.crt -text -noout
If you get the folowing error it means that you are trying to view a DER encoded certifciate and need to use the commands in the “View DER encoded certificate  below”

unable to load certificate
12626:error:0906D06C:PEM routines:PEM_read_bio:no start line:pem_lib.c:647:Expecting: TRUSTED CERTIFICATE
View DER encoded Certificate

openssl x509 -in certificate.der -inform der -text -noout
If you get the following error it means that you are trying to view a PEM encoded certificate with a command meant for DER encoded certs. Use a command in the “View PEM encoded certificate above

unable to load certificate
13978:error:0D0680A8:asn1 encoding routines:ASN1_CHECK_TLEN:wrong tag:tasn_dec.c:1306:
13978:error:0D07803A:asn1 encoding routines:ASN1_ITEM_EX_D2I:nested asn1 error:tasn_dec.c:380:Type=X509
Transform

Transforms can take one type of encoded certificate to another. (ie. PEM To DER conversion)

PEM to DER

openssl x509 -in cert.crt -outform der -out cert.der
DER to PEM

openssl x509 -in cert.crt -inform der -outform pem -out cert.pem
Combination

In some cases it is advantageous to combine multiple pieces of the X.509 infrastructure into a single file.  One common example would be to combine both the private key and public key into the same certificate.

The easiest way to combine certs keys and chains is to convert each to a PEM encoded certificate then simple copy the contents of each file into a new file.   This is suitable for combining files to use in applications lie Apache.

Extraction

Some certs will come in a combined form.  Where one file can contain any one of: Certificate, Private Key, Public Key, Signed Certificate, Certificate Authority (CA), and/or Authority Chain.

### Composite TrustManager

```java
package fr.arkey.elasticsearch.oauth.tools;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.List;
import com.google.common.collect.ImmutableList;

/**
 * Represents an ordered list of {@link X509TrustManager}s with additive trust. If any one of the composed managers
 * trusts a certificate chain, then it is trusted by the composite manager.
 *
 * This is necessary because of the fine-print on {@link SSLContext#init}: Only the first instance of a particular key
 * and/or trust manager implementation type in the array is used. (For example, only the first
 * javax.net.ssl.X509KeyManager in the array will be used.)
 *
 * <pre><code>
 * try {
 *     KeyStore keystore; // Get your own keystore here
 *     SSLContext sslContext = SSLContext.getInstance("TLS");
 *     TrustManager[] tm = CompositeX509TrustManager.getTrustManagers(keystore);
 *     sslContext.init(null, tm, null);
 * } catch (NoSuchAlgorithmException | KeyManagementException e) {
 *     e.printStackTrace();
 * }
 * </code></pre>
 *
 *
 * @author codyaray
 * @since 4/22/2013
 * @see <a href="http://stackoverflow.com/questions/1793979/registering-multiple-keystores-in-jvm">
 *     http://stackoverflow.com/questions/1793979/registering-multiple-keystores-in-jvm
 *     </a>
 */
@SuppressWarnings("unused")
public class CompositeX509TrustManager implements X509TrustManager {

    private final List<X509TrustManager> trustManagers;

    public CompositeX509TrustManager(List<X509TrustManager> trustManagers) {
        this.trustManagers = ImmutableList.copyOf(trustManagers);
    }

    public CompositeX509TrustManager(KeyStore keystore) {

        this.trustManagers = ImmutableList.of(getDefaultTrustManager(), getTrustManager(keystore));

    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        for (X509TrustManager trustManager : trustManagers) {
            try {
                trustManager.checkClientTrusted(chain, authType);
                return; // someone trusts them. success!
            } catch (CertificateException e) {
                // maybe someone else will trust them
            }
        }
        throw new CertificateException("None of the TrustManagers trust this certificate chain");
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        for (X509TrustManager trustManager : trustManagers) {
            try {
                trustManager.checkServerTrusted(chain, authType);
                return; // someone trusts them. success!
            } catch (CertificateException e) {
                // maybe someone else will trust them
            }
        }
        throw new CertificateException("None of the TrustManagers trust this certificate chain");
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        ImmutableList.Builder<X509Certificate> certificates = ImmutableList.builder();
        for (X509TrustManager trustManager : trustManagers) {
            for (X509Certificate cert : trustManager.getAcceptedIssuers()) {
                certificates.add(cert);
            }
        }
        return  certificates.build().toArray(new X509Certificate[0]);
    }

    public static TrustManager[] getTrustManagers(KeyStore keyStore) {

        return new TrustManager[] { new CompositeX509TrustManager(keyStore) };

    }

    public static X509TrustManager getDefaultTrustManager() {

        return getTrustManager(null);

    }

    public static X509TrustManager getTrustManager(KeyStore keystore) {
        return getTrustManager(TrustManagerFactory.getDefaultAlgorithm(), keystore);

    }

    public static X509TrustManager getTrustManager(String algorithm, KeyStore keystore) {

        TrustManagerFactory factory;

        try {
            factory = TrustManagerFactory.getInstance(algorithm);
            factory.init(keystore);
            return (X509TrustManager) Arrays.stream(factory.getTrustManagers())
                                            .filter((X509TrustManager.class)::isInstance)
                                            .findFirst()
                                            .orElse(null);
        } catch (NoSuchAlgorithmException | KeyStoreException e) {
            e.printStackTrace();
        }

        return null;
    }

}
```
