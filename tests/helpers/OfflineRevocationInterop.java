import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Security;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Date;
import org.bouncycastle.asn1.x509.CRLReason;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.Extensions;
import org.bouncycastle.asn1.ocsp.OCSPObjectIdentifiers;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.X509v2CRLBuilder;
import org.bouncycastle.cert.ocsp.BasicOCSPResp;
import org.bouncycastle.cert.ocsp.BasicOCSPRespBuilder;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPResp;
import org.bouncycastle.cert.ocsp.OCSPRespBuilder;
import org.bouncycastle.cert.ocsp.RespID;
import org.bouncycastle.cert.ocsp.RevokedStatus;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaContentVerifierProviderBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

class OfflineRevocationInterop {
    public static void main(String[] args) throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        Path directory = Path.of(args[0]);
        for (String algorithm : new String[] { "RSA", "ECDSA", "SM2" }) {
            X509CertificateHolder issuer = new X509CertificateHolder(Files.readAllBytes(directory.resolve(algorithm + "-issuer.der")));
            X509CertificateHolder leaf = new X509CertificateHolder(Files.readAllBytes(directory.resolve(algorithm + "-leaf.der")));
            PrivateKey key = KeyFactory.getInstance(algorithm.equals("RSA") ? "RSA" : "EC", "BC").generatePrivate(new PKCS8EncodedKeySpec(Files.readAllBytes(directory.resolve(algorithm + "-key.der"))));
            OCSPReq request = new OCSPReq(Files.readAllBytes(directory.resolve(algorithm + "-request.der")));
            BasicOCSPResp response = (BasicOCSPResp) new OCSPResp(Files.readAllBytes(directory.resolve(algorithm + "-response.der"))).getResponseObject();
            if (!response.isSignatureValid(new JcaContentVerifierProviderBuilder().setProvider("BC").build(issuer))) throw new AssertionError("Invalid " + algorithm + " OCSP signature");
            CertificateID id = request.getRequestList()[0].getCertID();
            if (!id.matchesIssuer(issuer, new JcaDigestCalculatorProviderBuilder().setProvider("BC").build()) || !id.getSerialNumber().equals(leaf.getSerialNumber()) || !id.equals(response.getResponses()[0].getCertID())) throw new AssertionError("CertID mismatch");
            if (!(response.getResponses()[0].getCertStatus() instanceof RevokedStatus)) throw new AssertionError("Expected revoked status");
            String signing = algorithm.equals("SM2") ? "SM3withSM2" : algorithm.equals("RSA") ? "SHA256withRSA" : "SHA256withECDSA";
            Date start = new Date(System.currentTimeMillis() - 60000), end = new Date(System.currentTimeMillis() + 3600000);
            BasicOCSPRespBuilder builder = new BasicOCSPRespBuilder(new RespID(issuer.getSubject()));
            builder.addResponse(id, CertificateStatus.GOOD, start, end, null);
            Extension nonce = request.getExtension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce);
            if (!nonce.equals(response.getExtension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce))) throw new AssertionError("Nonce mismatch");
            builder.setResponseExtensions(new Extensions(new Extension[] { nonce }));
            BasicOCSPResp basic = builder.build(new JcaContentSignerBuilder(signing).setProvider("BC").build(key), new X509CertificateHolder[] { issuer }, new Date());
            Files.write(directory.resolve(algorithm + "-bc-response.der"), new OCSPRespBuilder().build(OCSPRespBuilder.SUCCESSFUL, basic).getEncoded());
            X509v2CRLBuilder crl = new X509v2CRLBuilder(issuer.getSubject(), start);
            crl.setNextUpdate(end);
            crl.addCRLEntry(leaf.getSerialNumber(), new Date(System.currentTimeMillis() - 86400000), CRLReason.keyCompromise);
            Files.write(directory.resolve(algorithm + "-bc.crl"), crl.build(new JcaContentSignerBuilder(signing).setProvider("BC").build(key)).getEncoded());
        }
        System.out.println("OK offline revocation BC");
    }
}
