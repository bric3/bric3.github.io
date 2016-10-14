    ---
layout: post
title:
date: 2016-09-09
published: true
tags:
- DNS
author: Brice Dutheil
---

# What is an A record?

An `A` record maps a domain name to the IP address (IPv4) of the computer hosting the domain. Simply put, an A record is used to find the IP address of a computer connected to the internet from a name.

The _A_ in `A` record stands for _Address_. Whenever you visit a web site, send an email, connect to Twitter or Facebook or do almost anything on the Internet, the address you enter is a series of words connected with dots.

For example, to access the DNSimple website you enter `www.dnsimple.com`. At our name server there is an A record that points to the IP address `208.93.64.253`. This means that a request from your browser to `www.dnsimple.com` is directed to the server with IP address `208.93.64.253`.

`A` Records are the simplest type of DNS records, yet one of the primary records used in DNS servers.

You can actually do quite a bit more with `A` records, including using multiple `A` records for the same domain in order to provide redundancy. Additionally, multiple names could point to the same address, in which case each would have its own A record pointing to the that same IP address.

## Querying A records

You can use `dig` to determine the `A` record associated to a domain name. The result is contained in the `ANSWER` section and it contains the fully-qualified domain name (FQDN), the remaining time-to-live (TTL) and the IP address.

```
$ dig A api.dnsimple.com

; <<>> DiG 9.8.3-P1 <<>> A api.dnsimple.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 5792
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0

;; QUESTION SECTION:
;api.dnsimple.com.		IN	A

;; ANSWER SECTION:
api.dnsimple.com.	59	IN	A	208.93.64.253

;; Query time: 80 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; WHEN: Sun Jul 31 22:21:31 2016
;; MSG SIZE  rcvd: 50
```

## A record structure

A records with have the following information:

| Name | The host name for the record, without the domain name. This is generally referred as “subdomain”. We automatically append the domain name. |
| TTL | The time-to-leave in seconds. This is the amount of time the record is allowed to be cached by a resolver. |
| Address | The IPv4 address the A record points to. |

# The AAAA Record

Much like the `A` record is to the IPv4 address space, the `AAAA` record (also known as a _quad-A_ record) is to the IPv6 address space. An easy way to remember this is IPv4 addresses are 32 bits, and IPv6 addresses are 128 bits, so if an A record is 32 bits, 4xA (or AAAA) is 128 bits. (Sorry, I had to drop some algebraic nerd humor on you.) It's also a forward-looking DNS record.

A standard `AAAA` record looks much like this:

```
classicyuppie.com.    AAAA    2605:4500:2:25bc::  
```

The same rule applies for a quad-A record as a regular A record: you should only have one record per hostname in most cases.

# What is a CNAME record?

`CNAME` stands for _Canonical Name_. `CNAME` records can be used to alias one name to another.

For example, if you have a server where you keep all of your documents online, it might normally be accessed through `docs.example.com`. You may also want to access it through `documents.example.com`. One way to make this possible is to add a CNAME record that points `documents.example.com` to `docs.example.com`. When someone visits `documents.example.com` they will see the exact same content as `docs.example.com`.

To use `CNAME` records, select CNAME from the Add Record drop down in the advanced editor. Then enter the hostname you would like to alias from and the fully-qualified domain name you would like to alias to. You may also enter `@` in the Alias for field to represent the domain itself.

For example, if the domain were `example.com` and you wanted `www.example.com` to point to `example.com` you could put `www` in the name field and `@` in the alias for field.

# What is an ALIAS record?

An `ALIAS` record is a virtual record type that we created to provide `CNAME`-like behavior on apex domains.

For example, if your domain is `example.com` and you want it to point to a host name like `myapp.herokuapp.com`, then you cannot use a `CNAME` record, but you can use an `ALIAS` record. The `ALIAS` record will automatically resolve your domain to one or more `A` records at resolution time and thus resolvers see your domain simply as if it had `A` records.

# What is an MX record?

`MX` stands for _Mail eXchange_. `MX` Records tell email delivery agents where they should deliver your email. You can have many `MX` records for a domain, providing a way to have redundancy and ensure that email will always be delivered.

Google Apps provides a common example of using `MX` Records for email delivery. When you create a Google Apps account and you want your email to be delivered to your Google Apps mail account, Google provides you with a set of `MX` records that you need to add to DNSimple. Here are the default `MX` records that Google suggests you should add:

```
aspmx.l.google.com 1
alt1.aspmx.l.google.com 5
alt2.aspmx.l.google.com 5
aspmx2.googlemail.com 10
aspmx3.googlemail.com 10
```

Google provides you with 5 different servers that can accept your email. Each `MX` record includes a priority value, which is a relative value compared to the other priorities of `MX` records for your domain. Addresses with lower values will be used first. Therefore, when a mail agent wants to deliver an email to you it would first attempt to deliver to `aspmx.l.google.com`. If that server cannot handle the delivery it would then move onto `alt1.aspmx.l.google.com`, and if that server cannot handle the delivery then it would move onto `alt2.aspmx.l.google.com`, and so on.

`MX` records make it easy to define what servers should handle email delivery and allows you to provide multiple servers for maximum redundancy and ensured delivery.

# What is a NS Record?

An `NS` record is used to delegate a subdomain to a set of name servers. Whenever you delegate a domain to DNSimple the TLD authorities place `NS` records for your domain in the TLD name servers pointing to us. For example, in the `com` name servers there are the following entries delegating `dnsimple.com` to our name servers:

```
dnsimple.com. 172800 IN NS ns1.dnsimple.com.
dnsimple.com. 172800 IN NS ns2.dnsimple.com.
dnsimple.com. 172800 IN NS ns3.dnsimple.com.
dnsimple.com. 172800 IN NS ns4.dnsimple.com.
```

We also automatically publish `NS` records in our authoritative name servers for each domain we are authoritative for. These `NS` records will appear in the `System Records` section of each domain’s Manage page, and will either be our default name servers (`ns1.dnsimple.com` through `ns4.dnsimple.com`) or your vanity name servers if you have vanity name servers.

If you would like to delegate a registered domain name to a different DNS provider, then you can do that through the domain’s Manage page. You cannot remove or change the NS records for your domain in the Advanced Editor page.

# What is a SOA Record?

An `SOA` record is a _Start of Authority_. Every domain must have a _Start of Authority_ record at the cutover point where the domain is delegated from its parent domain. For example if the domain `mycompany.com` is delegated to DNSimple’s DNS servers, we must include an SOA record for the name `mycompany.com` in our authoritative DNS records. We add this record automatically for every domain that is added to DNSimple and we show this record to you as a _System Record_ in your domain’s Manage page.

Here is an example of the content from an SOA record:

```
ns1.dnsimple.com admin.dnsimple.com 2013022001 86400 7200 604800 300
```

The `SOA` record includes the following details:

* The primary name server for the domain, which is `ns1.dnsimple.com` or the first name server in the vanity name server list for vanity name servers.
* The responsible party for the domain, which is `admin.dnsimple.com`.
* A timestamp that changes whenever you update your domain.
* The number of seconds before the zone should be refreshed.
* The number of seconds before a failed refresh should be retried.
* The upper limit in seconds before a zone is considered no longer authoritative.
* The negative result TTL (for example, how long a resolver should consider a negative result for a subdomain to be valid before retrying).

For the moment, these values cannot be configured by you.

# What is a SRV Record?

`SRV` records are often used to help with service discovery. For example, `SRV` records are used in _Internet Telephony_ for defining where a SIP service may be found.

An `SRV` record typically defines a symbolic name and the transport protocol used as part of the domain name, and defines the priority, weight, port and target for the service in the record content.

Here is an example of two SRV records.

```
_sip._tcp.example.com.   3600 IN    SRV 10       60     5060 bigbox.example.com.
_sip._tcp.example.com.   3600 IN    SRV 10       20     5060 smallbox1.example.com.

```
From the name, `_sip` is the symbolic name for the service and `_tcp` is the transport protocol. Note that the symbolic name and transport always start with an underscore.

The content of the `SRV` record defines a priority of `10` for both records. The first record has a weight of `60` and the second a weight of `20`. The priority and weight values can be used to encourage use of certain servers over others.

The final two values in the record define the port and hostname to connect to for accessing the service.

# What is a PTR record and how to add one?

You can think of the `PTR` record as an opposite of the `A` record. While the `A` record points a domain name to an IP address, the `PTR` record resolves the IP address to a domain/hostname.

`PTR` records are used for the reverse DNS (Domain Name System) lookup. Using the IP address you can get the associated domain/hostname. An `A` record should exist for every PTR record.

This record type can be used to validate the true identity of a server for the purposes of SPAM-checking the server sending an email or for security certificate validation. It usually serves to prove the identity of a particular IP address exiting on the Internet.

Because a PTR record creates a reverse lookup (address-to-hostname), you cannot set this record type in the control panel of your DNS provider's control panel. The owner of the IP address must create the record for you. The owner is usually who gave you the IP address, such as your ISP or your web hosting provider. A word of caution: I don't know of any ISPs that will create a PTR record for you unless your IP address is static. If you're not sure if you have a static IP address, simply ask them.

The reason why the owner of the IP address must create it for you is because the reverse record is created using the in-addr.arpa domain. All IP addresses have a default hostname of the IP address, in reverse, followed by `in-addr.arpa` and as you can see from the example above, the FQDN of the IP address for my web server is `245.87.77.80.in-addr.arpa`. One is the forward address, the other is the reverse address. The only entity that has the authority to add a DNS record for your IP address is the entity that has access to the `x.x.x.x.in-addr.arpa` address, which again is the company that provided you with use of the IP in the first place. If you want to learn more about the `in-addr.arpa` domain, I might suggest reading up on [RFC 1035, section 3.5](http://tools.ietf.org/html/rfc1035#page-22).

You can check whether there is a `PTR` record set for a defined IP address.

```
dig -x 209.85.102.36

; <<>> DiG 9.5.1-P2.1 <<>> -x 209.85.102.36
;; global options: printcmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41537
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 2, ADDITIONAL: 2

;; QUESTION SECTION:
;36.102.85.209.in-addr.arpa. IN PTR

;; ANSWER SECTION:
36.102.85.209.in-addr.arpa. 7200 IN PTR serv01.siteground.com.

;; AUTHORITY SECTION:
102.85.209.in-addr.arpa. 7200 IN NS ns1.ev1servers.net.
102.85.209.in-addr.arpa. 7200 IN NS ns2.ev1servers.net.
```


# Differences between the A, CNAME, ALIAS and URL records

`A`, `CNAME`, `ALIAS` and `URL` records are all possible solutions to point a host name (name hereafter) to your site. However, they have some small differences that affect how the client will reach your site.

Before going further into the details, it’s important to know that `A` and `CNAME` records are standard DNS records, whilst `ALIAS` and `URL` records are custom DNS records provided by DNSimple’s DNS hosting. Both of them are translated internally into A records to ensure compatibility with the DNS protocol.

## Understanding the differences

Here’s the main differences:

* The `A` record maps a name to one or more IP addresses, when the IP are known and stable.
* The `CNAME` record maps a name to another name. It should only be used when there are no other records on that name.
* The `ALIAS` record maps a name to another name, but in turns it can coexist with other records on that name.
* The `URL` record redirects the name to the target name using the `HTTP 301` status code.

Some important rules to keep in mind:

* The `A`, `CNAME`, `ALIAS` records causes a name to resolve to an IP. Vice-versa, the `URL` record redirects the name to a destination. The `URL` record is simple and effective way to apply a redirect for a name to another name, for example to redirect `www.example.com` to `example.com`.
* The `A` name must resolve to an IP, the `CNAME` and `ALIAS` record must point to a name.

## Which one to use

Understanding the difference between the `A` name and the `CNAME` records will help you to decide.

The `A` and `CNAME` records are the two common ways to map a host name (name hereafter) to one or more IP address. Before going ahead, it’s important that you really understand the differences between these two records. I’ll keep it simple.

The A record points a name to a specific IP. For example, if you want the name blog.dnsimple.com to point to the server 185.31.17.133 you will configure:

```
blog.dnsimple.com.     A        185.31.17.133
```

The `CNAME` record points a name to another name, instead of an IP. The `CNAME` source represents an alias for the target name and inherits its entire resolution chain.

Let’s take our blog as example:

```
blog.dnsimple.com.      CNAME   aetrion.github.io.
aetrion.github.io.      CNAME   github.map.fastly.net.
github.map.fastly.net.  A       185.31.17.133

```
We use GitHub Pages and we set `blog.dnsimple.com` as a `CNAME` of `aetrion.github.io`, which in turns is itself a `CNAME` of `github.map.fastly.net`, which is an `A` record pointing to `185.31.17.133`. In short terms, this means that `blog.dnsimple.com` resolves to `185.31.17.133`.

To summarize, an `A` record points a name to an IP. `CNAME` record can point a name to another `CNAME` or an `A` record.


The general rule is:

* use an A record if you manage what IP addresses are assigned to a particular machine or if the IP are fixed (this is the most common case)
* use a CNAME record if you want to alias a name to another name, and you don’t need other records (such as MX records for emails) for the same name
* use an ALIAS record if you are trying to alias the root domain (apex zone) or if you need other records for the same name
* use the URL record if you want the name to redirect (change address) instead of resolving to a destination.

**You should never use a CNAME record for your root domain name (i.e. example.com).**


# Querying These Records

Since I'm a command line fan, in these articles, I'll be providing you an easy way to check the various DNS record types through the Linux/Unix terminal or Windows command prompt.

To query A or AAAA records:

```
dig a <hostname>  
dig aaaa <hostname>  
```

To query PTR records:

```
dig -x <ipv4 address>  
dig -x <ipv6 address>  
```
or

```
dig ptr <ipv4 address in reverse>.in-addr.arpa  
dig ptr <ipv6 address in reverse>.in-addr.arpa  

```
N.B.: When typing the IP in reverse, each octet in the IPv4 address must be seperated with a decimal. Each alphanumeric character in the IPv6 address must be seperated with a decimal.


EDITOR notes : https://classicyuppie.com/idea-dns-crash-course-cname-records/
