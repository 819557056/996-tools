import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.bouncycastle.asn1.ASN1Encodable;
import org.bouncycastle.asn1.ASN1Integer;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.ASN1OctetString;
import org.bouncycastle.asn1.ASN1Sequence;
import org.bouncycastle.asn1.ASN1Set;
import org.bouncycastle.asn1.DEROctetString;
import org.bouncycastle.asn1.DERSequence;
import org.bouncycastle.asn1.DERSet;
import org.bouncycastle.asn1.cms.CMSObjectIdentifiers;
import org.bouncycastle.asn1.cms.ContentInfo;
import org.bouncycastle.asn1.cms.EncryptedContentInfo;
import org.bouncycastle.asn1.cms.EnvelopedData;
import org.bouncycastle.asn1.cms.IssuerAndSerialNumber;
import org.bouncycastle.asn1.cms.KeyTransRecipientInfo;
import org.bouncycastle.asn1.cms.RecipientIdentifier;
import org.bouncycastle.asn1.cms.RecipientInfo;
import org.bouncycastle.asn1.gm.GMObjectIdentifiers;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.pkcs.Pfx;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.crypto.InvalidCipherTextException;
import org.bouncycastle.crypto.engines.SM2Engine;
import org.bouncycastle.crypto.params.ParametersWithRandom;
import org.bouncycastle.crypto.util.PrivateKeyFactory;
import org.bouncycastle.crypto.util.PublicKeyFactory;
import org.bouncycastle.jcajce.provider.asymmetric.ec.BCECPrivateKey;
import org.bouncycastle.jcajce.spec.SM2ParameterSpec;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.pkcs.PKCS10CertificationRequest;
import org.bouncycastle.pkcs.jcajce.JcaPKCS10CertificationRequestBuilder;
import org.bouncycastle.util.BigIntegers;

/**
 * 独立互操作测试基准，仅由 Node 测试使用 Java 17 源文件启动器运行。
 * CMS 范围是单接收者 KeyTransRecipientInfo + SM2 DER 密钥密文 + SM4-CBC，
 * 不表示覆盖全部 GM/T 信封规范，也不为应用引入 Java 运行时依赖。
 */
public final class PkiSm2Interop {
    private static final String DEFAULT_ID = "1234567812345678";
    private static final String CUSTOM_ID = "interop-测试";
    private static final String TEST_PASSWORD = "interop-测试-123";
    private static final String TEST_ALIAS = "互操作测试";
    private static final ASN1ObjectIdentifier SM2_ENCRYPT = new ASN1ObjectIdentifier("1.2.156.10197.1.301.3");
    private static final ASN1ObjectIdentifier SM4_CBC = new ASN1ObjectIdentifier("1.2.156.10197.1.104.2");
    private static final SecureRandom RANDOM = new SecureRandom();

    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Expected action and fixture directory");
        Security.addProvider(new BouncyCastleProvider());
        Path directory = Path.of(args[1]);
        switch (args[0]) {
            case "fixtures" -> generateFixtures(directory);
            case "csr" -> verifyCsr(directory);
            case "certificate" -> verifyCertificate(directory);
            case "cipher" -> verifyCipher(directory);
            case "envelope" -> verifyEnvelope(directory);
            case "pkcs12" -> verifyPkcs12(directory);
            default -> throw new IllegalArgumentException("Unknown test action");
        }
        System.out.println("OK " + args[0] + " BC " + Security.getProvider("BC").getVersionStr());
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static PrivateKey privateKey(Path directory, String prefix) throws IOException {
        return new JcaPEMKeyConverter().setProvider("BC")
            .getPrivateKey(PrivateKeyInfo.getInstance(Files.readAllBytes(directory.resolve(prefix + "-private.der"))));
    }

    private static X509CertificateHolder certificate(Path directory, String file) throws IOException {
        return new X509CertificateHolder(Files.readAllBytes(directory.resolve(file)));
    }

    private static PublicKey publicKey(X509CertificateHolder certificate) throws IOException {
        return new JcaPEMKeyConverter().setProvider("BC").getPublicKey(certificate.getSubjectPublicKeyInfo());
    }

    private static boolean verify(PublicKey key, byte[] data, byte[] signature, String userId)
        throws GeneralSecurityException {
        Signature verifier = Signature.getInstance("SM3withSM2", "BC");
        verifier.setParameter(new SM2ParameterSpec(userId.getBytes(StandardCharsets.UTF_8)));
        verifier.initVerify(key);
        verifier.update(data);
        return verifier.verify(signature);
    }

    private static byte[] sign(PrivateKey key, byte[] data, String userId) throws GeneralSecurityException {
        Signature signer = Signature.getInstance("SM3withSM2", "BC");
        signer.setParameter(new SM2ParameterSpec(userId.getBytes(StandardCharsets.UTF_8)));
        signer.initSign(key, RANDOM);
        signer.update(data);
        return signer.sign();
    }

    private static ContentSigner contentSigner(PrivateKey key, String userId) {
        return new ContentSigner() {
            private final ByteArrayOutputStream output = new ByteArrayOutputStream();
            @Override public AlgorithmIdentifier getAlgorithmIdentifier() {
                return new AlgorithmIdentifier(GMObjectIdentifiers.sm2sign_with_sm3);
            }
            @Override public OutputStream getOutputStream() { return output; }
            @Override public byte[] getSignature() {
                try {
                    return sign(key, output.toByteArray(), userId);
                } catch (GeneralSecurityException exception) {
                    throw new IllegalStateException("Could not sign synthetic test fixture", exception);
                }
            }
        };
    }

    private static void verifyCsr(Path directory) throws IOException, GeneralSecurityException {
        for (String suffix : new String[] { "", "-custom" }) {
            byte[] encoded = Files.readAllBytes(directory.resolve("browser-csr" + suffix + ".der"));
            PKCS10CertificationRequest request = new PKCS10CertificationRequest(encoded);
            check(request.getSignatureAlgorithm().getAlgorithm().equals(GMObjectIdentifiers.sm2sign_with_sm3), "CSR signature OID");
            PublicKey key = new JcaPEMKeyConverter().setProvider("BC").getPublicKey(request.getSubjectPublicKeyInfo());
            byte[] tbs = request.toASN1Structure().getCertificationRequestInfo().getEncoded("DER");
            String userId = suffix.isEmpty() ? DEFAULT_ID : CUSTOM_ID;
            byte[] preservedTbs = ASN1Sequence.getInstance(encoded).getObjectAt(0).toASN1Primitive().getEncoded("DL");
            check(Arrays.equals(tbs, preservedTbs), "Browser CSR TBS must already be canonical DER");
            check(verify(key, tbs, request.getSignature(), userId), "Browser CSR signature");
            check(!verify(key, tbs, request.getSignature(), "wrong-id"), "CSR must bind SM2 user ID");
            byte[] modified = tbs.clone();
            modified[modified.length - 1] ^= 1;
            check(!verify(key, modified, request.getSignature(), userId), "CSR tampering must fail");
        }
    }

    private static void verifyCertificate(Path directory) throws IOException, GeneralSecurityException {
        for (String suffix : new String[] { "", "-custom" }) {
            X509CertificateHolder certificate = certificate(directory, "browser-certificate" + suffix + ".der");
            check(certificate.getSignatureAlgorithm().getAlgorithm().equals(GMObjectIdentifiers.sm2sign_with_sm3), "Certificate signature OID");
            check(certificate.getIssuer().equals(certificate.getSubject()), "Self-signed certificate issuer");
            check(!BasicConstraints.fromExtensions(certificate.getExtensions()).isCA(), "Leaf CA constraint");
            check(KeyUsage.fromExtensions(certificate.getExtensions()).hasUsages(KeyUsage.keyEncipherment), "Encryption key usage");
            check(certificate.getExtension(Extension.subjectAlternativeName) != null, "Certificate SAN");
            byte[] tbs = certificate.toASN1Structure().getTBSCertificate().getEncoded("DER");
            String userId = suffix.isEmpty() ? DEFAULT_ID : CUSTOM_ID;
            check(verify(publicKey(certificate), tbs, certificate.getSignature(), userId), "Browser certificate signature");
            check(!verify(publicKey(certificate), tbs, certificate.getSignature(), "wrong-id"), "Certificate must bind SM2 user ID");
            byte[] modified = tbs.clone();
            modified[modified.length - 1] ^= 1;
            check(!verify(publicKey(certificate), modified, certificate.getSignature(), userId), "Certificate tampering must fail");
        }
    }

    private static byte[] encrypt(PublicKey key, byte[] content) throws IOException, InvalidCipherTextException {
        SM2Engine engine = new SM2Engine(SM2Engine.Mode.C1C3C2);
        engine.init(true, new ParametersWithRandom(PublicKeyFactory.createKey(key.getEncoded()), RANDOM));
        byte[] raw = engine.processBlock(content, 0, content.length);
        return new DERSequence(new ASN1Encodable[] {
            new ASN1Integer(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33))),
            new ASN1Integer(new BigInteger(1, Arrays.copyOfRange(raw, 33, 65))),
            new DEROctetString(Arrays.copyOfRange(raw, 65, 97)),
            new DEROctetString(Arrays.copyOfRange(raw, 97, raw.length))
        }).getEncoded("DER");
    }

    private static byte[] decrypt(PrivateKey key, byte[] encoded) throws IOException, InvalidCipherTextException {
        ASN1Sequence cipher = ASN1Sequence.getInstance(encoded);
        check(cipher.size() == 4, "SM2 DER must contain x, y, C3, C2");
        byte[] digest = ASN1OctetString.getInstance(cipher.getObjectAt(2)).getOctets();
        byte[] ciphertext = ASN1OctetString.getInstance(cipher.getObjectAt(3)).getOctets();
        check(digest.length == 32, "SM2 C3 size");
        byte[] raw = new byte[97 + ciphertext.length];
        raw[0] = 4;
        System.arraycopy(BigIntegers.asUnsignedByteArray(32, ASN1Integer.getInstance(cipher.getObjectAt(0)).getValue()), 0, raw, 1, 32);
        System.arraycopy(BigIntegers.asUnsignedByteArray(32, ASN1Integer.getInstance(cipher.getObjectAt(1)).getValue()), 0, raw, 33, 32);
        System.arraycopy(digest, 0, raw, 65, 32);
        System.arraycopy(ciphertext, 0, raw, 97, ciphertext.length);
        SM2Engine engine = new SM2Engine(SM2Engine.Mode.C1C3C2);
        engine.init(false, PrivateKeyFactory.createKey(key.getEncoded()));
        return engine.processBlock(raw, 0, raw.length);
    }

    private static byte[] corruptDigest(byte[] encoded) throws IOException {
        ASN1Sequence cipher = ASN1Sequence.getInstance(encoded);
        byte[] digest = ASN1OctetString.getInstance(cipher.getObjectAt(2)).getOctets().clone();
        digest[0] ^= 1;
        return new DERSequence(new ASN1Encodable[] {
            cipher.getObjectAt(0), cipher.getObjectAt(1), new DEROctetString(digest), cipher.getObjectAt(3)
        }).getEncoded("DER");
    }

    private static void verifyCipher(Path directory) throws IOException, InvalidCipherTextException {
        PrivateKey key = privateKey(directory, "browser");
        byte[] ciphertext = Files.readAllBytes(directory.resolve("browser-cipher.der"));
        check(Arrays.equals(decrypt(key, ciphertext), Files.readAllBytes(directory.resolve("direct-content.bin"))), "Browser SM2 DER ciphertext");
        try {
            decrypt(key, corruptDigest(ciphertext));
            throw new AssertionError("SM2 modified C3 must fail");
        } catch (InvalidCipherTextException expected) {
            // 独立实现必须拒绝完整性校验错误，不能返回未验证明文。
        }
    }

    private static byte[] sm4(int mode, byte[] key, byte[] iv, byte[] content) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("SM4/CBC/PKCS7Padding", "BC");
        cipher.init(mode, new SecretKeySpec(key, "SM4"), new IvParameterSpec(iv));
        return cipher.doFinal(content);
    }

    private static byte[] envelope(PublicKey key, X509CertificateHolder recipient, byte[] content, boolean invalidPadding)
        throws IOException, GeneralSecurityException, InvalidCipherTextException {
        byte[] secret = new byte[16], iv = new byte[16];
        RANDOM.nextBytes(secret);
        RANDOM.nextBytes(iv);
        try {
            byte[] encryptedContent = sm4(Cipher.ENCRYPT_MODE, secret, iv, content);
            if (invalidPadding) iv[15] ^= 1; // 空明文单块填充 0x10 被确定性破坏。
            KeyTransRecipientInfo recipientInfo = new KeyTransRecipientInfo(
                new RecipientIdentifier(new IssuerAndSerialNumber(recipient.getIssuer(), recipient.getSerialNumber())),
                new AlgorithmIdentifier(SM2_ENCRYPT), new DEROctetString(encrypt(key, secret)));
            EncryptedContentInfo encrypted = new EncryptedContentInfo(CMSObjectIdentifiers.data,
                new AlgorithmIdentifier(SM4_CBC, new DEROctetString(iv)), new DEROctetString(encryptedContent));
            return new ContentInfo(CMSObjectIdentifiers.envelopedData, new EnvelopedData(null,
                new DERSet(new RecipientInfo(recipientInfo)), encrypted, (ASN1Set) null)).getEncoded("DER");
        } finally {
            Arrays.fill(secret, (byte) 0);
        }
    }

    private static void verifyEnvelope(Path directory) throws IOException, GeneralSecurityException, InvalidCipherTextException {
        PrivateKey key = privateKey(directory, "browser");
        X509CertificateHolder certificate = certificate(directory, "browser-certificate.der");
        for (String name : new String[] { "empty", "binary", "large" }) {
            ContentInfo outer = ContentInfo.getInstance(Files.readAllBytes(directory.resolve("browser-envelope-" + name + ".der")));
            check(outer.getContentType().equals(CMSObjectIdentifiers.envelopedData), "CMS envelope content type");
            EnvelopedData envelope = EnvelopedData.getInstance(outer.getContent());
            check(envelope.getVersion().hasValue(0) && envelope.getRecipientInfos().size() == 1, "CMS version/recipient count");
            RecipientInfo info = RecipientInfo.getInstance(envelope.getRecipientInfos().getObjectAt(0));
            check(!info.isTagged(), "CMS key transport recipient");
            KeyTransRecipientInfo recipient = KeyTransRecipientInfo.getInstance(info.getInfo());
            check(recipient.getVersion().hasValue(0) && !recipient.getRecipientIdentifier().isTagged(), "CMS issuer/serial recipient");
            IssuerAndSerialNumber rid = IssuerAndSerialNumber.getInstance(recipient.getRecipientIdentifier().getId());
            check(rid.getName().equals(certificate.getIssuer()) && rid.getSerialNumber().getValue().equals(certificate.getSerialNumber()), "CMS recipient identity");
            check(recipient.getKeyEncryptionAlgorithm().getAlgorithm().equals(SM2_ENCRYPT), "CMS SM2 key transport OID");
            EncryptedContentInfo content = envelope.getEncryptedContentInfo();
            check(content.getContentType().equals(CMSObjectIdentifiers.data), "CMS embedded content type");
            check(content.getContentEncryptionAlgorithm().getAlgorithm().equals(SM4_CBC), "CMS SM4-CBC OID");
            byte[] secret = decrypt(key, recipient.getEncryptedKey().getOctets());
            byte[] iv = ASN1OctetString.getInstance(content.getContentEncryptionAlgorithm().getParameters()).getOctets();
            try {
                check(secret.length == 16 && iv.length == 16, "CMS SM4 key/IV size");
                byte[] plaintext = sm4(Cipher.DECRYPT_MODE, secret, iv, content.getEncryptedContent().getOctets());
                check(Arrays.equals(plaintext, Files.readAllBytes(directory.resolve(name + ".bin"))), "Browser SM2/SM4 CMS plaintext");
            } finally {
                Arrays.fill(secret, (byte) 0);
            }
        }
    }

    private static void verifyPkcs12(Path directory) throws IOException, GeneralSecurityException {
        byte[] encoded = Files.readAllBytes(directory.resolve("browser.p12"));
        char[] password = TEST_PASSWORD.toCharArray();
        KeyStore store = KeyStore.getInstance("PKCS12", "BC");
        try {
            store.load(new ByteArrayInputStream(encoded), password);
            check(store.size() == 1 && store.isKeyEntry(TEST_ALIAS), "PFX alias/key entry");
            PrivateKey recovered = (PrivateKey) store.getKey(TEST_ALIAS, password);
            PrivateKey expected = privateKey(directory, "browser");
            check(((BCECPrivateKey) recovered).getD().equals(((BCECPrivateKey) expected).getD()), "PFX private scalar");
            check(Arrays.equals(store.getCertificate(TEST_ALIAS).getEncoded(), Files.readAllBytes(directory.resolve("browser-certificate.der"))), "PFX certificate");
            byte[] content = Files.readAllBytes(directory.resolve("direct-content.bin"));
            check(verify(store.getCertificate(TEST_ALIAS).getPublicKey(), content, sign(recovered, content, DEFAULT_ID), DEFAULT_ID), "PFX recovered key pair");
            try {
                KeyStore.getInstance("PKCS12", "BC").load(new ByteArrayInputStream(encoded), "wrong-password".toCharArray());
                throw new AssertionError("PFX must reject wrong password");
            } catch (IOException expectedFailure) {
                // MAC 不匹配必须拒绝加载。
            }
            // 修改 AuthenticatedSafe 字节，保留容器 ASN.1 结构，让 MAC 检测篡改。
            Pfx original = Pfx.getInstance(encoded);
            org.bouncycastle.asn1.pkcs.ContentInfo safe = original.getAuthSafe();
            byte[] safeBytes = ASN1OctetString.getInstance(safe.getContent()).getOctets();
            safeBytes[safeBytes.length - 1] ^= 1;
            byte[] corrupt = new Pfx(new org.bouncycastle.asn1.pkcs.ContentInfo(CMSObjectIdentifiers.data,
                new DEROctetString(safeBytes)), original.getMacData()).getEncoded("DER");
            try {
                KeyStore.getInstance("PKCS12", "BC").load(new ByteArrayInputStream(corrupt), password);
                throw new AssertionError("PFX must reject modified authenticated safe");
            } catch (IOException expectedFailure) {
                // 篡改必须由独立实现拒绝。
            }
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    private static void generateFixtures(Path directory) throws IOException, GeneralSecurityException, InvalidCipherTextException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", "BC");
        generator.initialize(new ECGenParameterSpec("sm2p256v1"), RANDOM);
        KeyPair identity = generator.generateKeyPair();
        Files.write(directory.resolve("bc-private.der"), identity.getPrivate().getEncoded());
        X500Name subject = new X500Name("CN=BC Interop,O=Synthetic Test,C=CN");
        X509CertificateHolder certificate = null;
        for (String suffix : new String[] { "", "-custom" }) {
            String userId = suffix.isEmpty() ? DEFAULT_ID : CUSTOM_ID;
            PKCS10CertificationRequest request = new JcaPKCS10CertificationRequestBuilder(subject, identity.getPublic())
                .build(contentSigner(identity.getPrivate(), userId));
            Files.write(directory.resolve("bc-csr" + suffix + ".der"), request.getEncoded());
            JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(subject, new BigInteger(127, RANDOM).add(BigInteger.ONE),
                Date.from(Instant.now().minusSeconds(60)), Date.from(Instant.now().plusSeconds(86400)), subject, identity.getPublic());
            builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(false));
            builder.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.digitalSignature | KeyUsage.keyEncipherment));
            X509CertificateHolder generated = builder.build(contentSigner(identity.getPrivate(), userId));
            Files.write(directory.resolve("bc-certificate" + suffix + ".der"), generated.getEncoded());
            if (suffix.isEmpty()) certificate = generated;
            Files.write(directory.resolve("bc-signature" + suffix + ".der"), sign(identity.getPrivate(), Files.readAllBytes(directory.resolve("direct-content.bin")), userId));
        }
        byte[] ciphertext = encrypt(identity.getPublic(), Files.readAllBytes(directory.resolve("direct-content.bin")));
        Files.write(directory.resolve("bc-cipher.der"), ciphertext);
        Files.write(directory.resolve("bc-cipher-bad-digest.der"), corruptDigest(ciphertext));
        for (String name : new String[] { "empty", "binary", "large" }) {
            Files.write(directory.resolve("bc-envelope-" + name + ".der"),
                envelope(identity.getPublic(), certificate, Files.readAllBytes(directory.resolve(name + ".bin")), false));
        }
        Files.write(directory.resolve("bc-envelope-bad-padding.der"), envelope(identity.getPublic(), certificate, new byte[0], true));
    }
}
