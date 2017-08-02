---
layout: post
title: Se connecter en java sur une URL HTTPS avec un certificat auto-signé
date: 2017-05-10
published: false
tags:
- ssl
- https
- java
- openssl
- libressl
- trustmanager
- certificate authority
- self-signed certificates
- auto-signé certificats
author: Brice Dutheil
---






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

En revanche nous voulons créer un truststore alternatif, our cela nous utilisons `keytool` un outils du JDK pour gérer
clés et certificats.

À noter que le **certificat** au format `pem` sera stocké dans un **key** store. L'extension `jks` vient du type de keystore, et correspond à Java Key Store.

```sh
# Creates local truststore, the tool will ask for a password and if the certificate can be trusted
keytool -import -alias host -file host.pem -keystore host-truststore.jks
```

Ce java keystore peut être créé sans interation

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












Attention la javadoc de `SSLContext#init` indique que seul le premier élément du tableau sera utilisé.

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
**Only the first instance** of a particular key and/or trust manager implementation type in the array is used. (For example, only the first javax.net.ssl.X509KeyManager in the array will be used.)
>
> Parameters:
>     km - the sources of authentication keys or null
>     tm - the sources of peer authentication trust decisions or null
>     random - the source of randomness for this generator or null
> Throws:
>    KeyManagementException - if this operation fails








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
