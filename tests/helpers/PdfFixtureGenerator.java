// Optional test fixture generator, using iText 9.6 and BouncyCastle 1.84 only.
// All identities are generated in memory; only synthetic signed PDFs/certificates are written.
import com.itextpdf.kernel.pdf.PdfDictionary;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfName;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfString;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.StampingProperties;
import com.itextpdf.kernel.pdf.WriterProperties;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.signatures.IExternalSignatureContainer;
import com.itextpdf.signatures.PdfSigner;
import com.itextpdf.signatures.SignerProperties;
import org.bouncycastle.asn1.ASN1Encodable;
import org.bouncycastle.asn1.ASN1Integer;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.DERBitString;
import org.bouncycastle.asn1.DERGeneralizedTime;
import org.bouncycastle.asn1.DERIA5String;
import org.bouncycastle.asn1.DEROctetString;
import org.bouncycastle.asn1.DERSequence;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.jcajce.JcaCertStore;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.CMSSignedDataGenerator;
import org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Security;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Date;
import java.util.List;

public final class PdfFixtureGenerator {
    private record Identity(KeyPair keys, X509Certificate certificate, String signature) { }

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || args.length > 2 || (args.length == 2 && !args[1].equals("pss-only"))) {
            throw new IllegalArgumentException("Supply fixture output directory and optional pss-only");
        }
        Security.addProvider(new BouncyCastleProvider());
        Path output = Path.of(args[0]);
        Files.createDirectories(output);
        if (args.length == 2) {
            writePss(output, plain(false), identity("RSA"));
            return;
        }
        byte[] plain = plain(false), compressed = plain(true);
        Files.write(output.resolve("unsigned.pdf"), plain);
        Identity sm2 = identity("SM2"), rsa = identity("RSA"), ec = identity("ECDSA");
        Files.write(output.resolve("sm2-signer.cer"), sm2.certificate().getEncoded());
        for (String format : List.of("cms", "ses", "raw")) {
            Files.write(output.resolve("sm2-" + format + ".pdf"), sign(plain, sm2, format, "Signature1", false));
        }
        Files.write(output.resolve("rsa-cms.pdf"), sign(plain, rsa, "cms", "Signature1", false));
        Files.write(output.resolve("ecdsa-cms.pdf"), sign(plain, ec, "cms", "Signature1", false));
        Files.write(output.resolve("rsa-direct-cms.pdf"), sign(plain, rsa, "cms", "Signature1", true));
        writePss(output, plain, rsa);
        Files.write(output.resolve("sm2-xref-stream.pdf"), sign(compressed, sm2, "cms", "Signature1", false));
        byte[] first = sign(plain, sm2, "cms", "Signature1", false);
        Files.write(output.resolve("two-signatures.pdf"), sign(first, rsa, "cms", "Signature2", false));
        System.out.println("Generated synthetic iText/BC PDFs; all payload signatures independently verified");
    }

    private static void writePss(Path output, byte[] plain, Identity rsa) throws Exception {
        Identity pss = new Identity(rsa.keys(), rsa.certificate(), "SHA256withRSAandMGF1");
        Files.write(output.resolve("rsa-pss-cms.pdf"), sign(plain, pss, "cms", "Signature1", false));
        System.out.println("Generated RSA-PSS CMS fixture; independently verified with BouncyCastle");
    }

    private static Identity identity(String type) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance(type.equals("RSA") ? "RSA" : "EC", "BC");
        if (type.equals("RSA")) generator.initialize(2048);
        else generator.initialize(new ECGenParameterSpec(type.equals("SM2") ? "sm2p256v1" : "secp256r1"));
        KeyPair keys = generator.generateKeyPair();
        String signature = type.equals("SM2") ? "SM3withSM2" : type.equals("RSA") ? "SHA256withRSA" : "SHA256withECDSA";
        X500Name name = new X500Name("CN=Offline PDF fixture " + type + ",O=996 Tools,C=CN");
        var builder = new JcaX509v3CertificateBuilder(name, new BigInteger(120, new java.security.SecureRandom()),
                Date.from(Instant.parse("2020-01-01T00:00:00Z")), Date.from(Instant.parse("2100-01-01T00:00:00Z")), name, keys.getPublic());
        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(false));
        builder.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.digitalSignature));
        X509Certificate certificate = new JcaX509CertificateConverter().setProvider("BC").getCertificate(
                builder.build(new JcaContentSignerBuilder(signature).setProvider("BC").build(keys.getPrivate())));
        certificate.verify(keys.getPublic(), "BC");
        return new Identity(keys, certificate, signature);
    }

    private static byte[] plain(boolean compressed) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(output, new WriterProperties().setFullCompressionMode(compressed)));
                Document document = new Document(pdf)) {
            document.add(new Paragraph("Synthetic offline verification fixture. Not a real document."));
        }
        return output.toByteArray();
    }

    private static byte[] sign(byte[] input, Identity identity, String format, String field, boolean direct) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        final byte[][] captured = { null };
        PdfSigner signer = new PdfSigner(new PdfReader(new ByteArrayInputStream(input)), output, null,
                new StampingProperties().useAppendMode(), new SignerProperties().setFieldName(field));
        signer.signExternalContainer(new IExternalSignatureContainer() {
            @Override public byte[] sign(InputStream stream) throws GeneralSecurityException {
                try {
                    // iText's ranged stream can return a short/zero-length read at a
                    // segment boundary. transferTo keeps reading through that boundary.
                    var contentOutput = new ByteArrayOutputStream();
                    stream.transferTo(contentOutput);
                    byte[] content = contentOutput.toByteArray();
                    captured[0] = content;
                    if (format.equals("cms")) {
                        CMSSignedDataGenerator generator = new CMSSignedDataGenerator();
                        var info = new JcaSignerInfoGeneratorBuilder(new JcaDigestCalculatorProviderBuilder().setProvider("BC").build());
                        info.setDirectSignature(direct);
                        generator.addSignerInfoGenerator(info.build(new JcaContentSignerBuilder(identity.signature()).setProvider("BC")
                                .build(identity.keys().getPrivate()), identity.certificate()));
                        generator.addCertificates(new JcaCertStore(List.of(identity.certificate())));
                        byte[] encoded = generator.generate(new CMSProcessableByteArray(content), false).getEncoded();
                        CMSSignedData parsed = new CMSSignedData(new CMSProcessableByteArray(content), encoded);
                        for (var item : parsed.getSignerInfos().getSigners()) {
                            if (!item.verify(new JcaSimpleSignerInfoVerifierBuilder().setProvider("BC").build(identity.certificate()))) {
                                throw new GeneralSecurityException("Independent CMS verification failed");
                            }
                        }
                        return encoded;
                    }
                    byte[] hash = MessageDigest.getInstance("SM3", "BC").digest(content);
                    if (format.equals("raw")) return signed(identity, hash);
                    // The SES outer structure follows the original service; the nested seal is
                    // deliberately a synthetic placeholder because this fixture tests outer verification.
                    var tbs = new DERSequence(new ASN1Encodable[]{new ASN1Integer(4), new DERSequence(),
                            new DERGeneralizedTime(Date.from(Instant.parse("2026-10-23T00:00:00Z"))),
                            new DERBitString(hash), new DERIA5String(Integer.toString(content.length))});
                    return new DERSequence(new ASN1Encodable[]{tbs, new DEROctetString(identity.certificate().getEncoded()),
                            new ASN1ObjectIdentifier("1.2.156.10197.1.501"), new DERBitString(signed(identity, tbs.getEncoded()))}).getEncoded();
                } catch (Exception exception) {
                    throw new GeneralSecurityException("Fixture signature generation failed", exception);
                }
            }
            @Override public void modifySigningDictionary(PdfDictionary dictionary) {
                dictionary.put(PdfName.Filter, format.equals("cms") ? PdfName.Adobe_PPKLite : new PdfName("GM.PKILite"));
                dictionary.put(PdfName.SubFilter, format.equals("cms") ? PdfName.Adbe_pkcs7_detached : new PdfName("GM.sm2seal"));
                if (format.equals("raw")) {
                    try { dictionary.put(PdfName.Cert, new PdfString(identity.certificate().getEncoded())); }
                    catch (Exception exception) { throw new IllegalStateException("Fixture certificate encoding failed", exception); }
                }
            }
        }, 16384);
        byte[] result = output.toByteArray();
        try (PdfDocument doc = new PdfDocument(new PdfReader(new ByteArrayInputStream(result)))) {
            var range = new com.itextpdf.signatures.SignatureUtil(doc).getSignatureDictionary(field).getAsArray(PdfName.ByteRange).toLongArray();
            var joined = new ByteArrayOutputStream();
            for (int i = 0; i < range.length; i += 2) joined.write(result, (int) range[i], (int) range[i + 1]);
            byte[] finalContent = joined.toByteArray();
            if (!java.util.Arrays.equals(finalContent, captured[0])) {
                int offset = java.util.Arrays.mismatch(finalContent, captured[0]);
                throw new IllegalStateException("Final PDF bytes differ from signing input: " + field + " at " + offset
                    + " final=" + finalContent.length + " captured=" + captured[0].length);
            }
        }
        return result;
    }

    private static byte[] signed(Identity identity, byte[] message) throws Exception {
        Signature signer = Signature.getInstance(identity.signature(), "BC");
        signer.initSign(identity.keys().getPrivate()); signer.update(message);
        byte[] signature = signer.sign();
        signer.initVerify(identity.keys().getPublic()); signer.update(message);
        if (!signer.verify(signature)) throw new GeneralSecurityException("Independent signature verification failed");
        return signature;
    }
}
