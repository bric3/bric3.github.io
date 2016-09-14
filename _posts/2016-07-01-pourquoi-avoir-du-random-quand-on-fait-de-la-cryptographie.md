---
layout: post
title: Pourquoi avoir du random quand on fait de la cryptographie
date: 2016-06-26
published: true
tags:
- random
- cryptography
- cryptographie
author: Brice Dutheil
---

# question

How can encryption involve randomness?

If an encryption algorithm is meant to convert a string to another string which can then be decrypted back to the original, how could this process involve any randomness?

Surely it has to be deterministic, otherwise how could the decryption function know what factors were involved in creating the encrypted string?



# answer


Well, the idea behind randomized encryption is that a single plaintext $$P$$ can encrypt into many different ciphertexts $$C_1, C_2, ..., C_n$$, and that when we encrypt, we pick one of those ciphertexts randomly.  Of course, because the decryptor has no way to knowing apriori which one we picked, it must be able to map any of those ciphertexts back into the original plaintext.

If the ciphertext $$C_i$$ was exactly as long as the plaintext $P$, then there would be an obvious problem; if the plaintext was $$k$$ bits long (and hence there are $$2^k$$ distinct plaintexts), and there are $$n$$ ciphertexts for each plaintext, we have $$n2^k$$ ciphertexts (which must all be distinct), and only $$2^k$$ bit patterns available to express them.

The obvious solution to this is that the ciphertexts must be longer than the corresponding plaintext.  In particular, if each ciphertext was at least $$\log n$$ bits longer, then everything fits nicely; we have $$n2^k = 2^{k + \log n}$$ ciphertexts and $$2^{k + \log n}$$ bit patterns to express them.

Now, the obvious question is: why does anyone bother?  The answer to that is, well, it provides better protection than deterministic methods.  It is generally the case that we'll send multiple messages with the same key.  If we happen to send the same message twice, deterministic encryption would make that obvious to the attacker (because the ciphertexts will be exactly identical), and that is information we'd rather the attacker not have.  Even if we'll never send the same message twice, we may send related messages.  While it is possible to design a deterministic encryption method that doesn't leak any information when given related messages, it's harder than you'd think.  In contrast, the goal behind nondetermanstic encryption is to make all the messages look perfectly random (even if we decide the send the same message multiple times); that turns out to be a rather easier goal to achieve.

One common way nondetermanistic encryption is implemented with [CBC mode][1]; the encryptor chooses a random block (known as an IV; 128 bits if he is using AES), and uses that to encrypt the message.  He sends the IV along with the encrypted message to the decryptor, who can uniquely decrypt the message.  One nice property about CBC mode is that it is easy to prove that if the IV is chosen randomly, and that the underlying block cipher is secure, then an attacker cannot distinguish the encryption from a random source.

[1]: http://en.wikipedia.org/wiki/Cipher_block_chaining#Cipher-block_chaining_.28CBC.29



http://crypto.stackexchange.com/questions/2686/how-can-encryption-involve-randomness/2687#2687


https://docs.oracle.com/javase/7/docs/api/javax/crypto/Cipher.html
