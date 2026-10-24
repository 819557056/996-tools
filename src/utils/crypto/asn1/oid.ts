// OID constants used by GM/T ecosystem.
// Keep as plain strings so upper layers (CMS/X.509) can reuse directly.

export const OID = {
  // SM2 elliptic curve public key
  SM2: "1.2.156.10197.1.301",

  // Hash
  SM3: "1.2.156.10197.1.401",

  // Block cipher
  SM4: "1.2.156.10197.1.104",

  // Commonly used combined signature algorithm id in many toolchains.
  // NOTE: confirm exact OID with your interop target (gmssl/openssl branch).
  SM2_SIGN_WITH_SM3: "1.2.156.10197.1.501",

  // CMS/PKCS#7 content types (RFC 5652)
  CMS_DATA: "1.2.840.113549.1.7.1",
  CMS_SIGNED_DATA: "1.2.840.113549.1.7.2",
  CMS_ENVELOPED_DATA: "1.2.840.113549.1.7.3",

  // CMS attributes (RFC 5652)
  CMS_CONTENT_TYPE: "1.2.840.113549.1.9.3",
  CMS_MESSAGE_DIGEST: "1.2.840.113549.1.9.4",
  CMS_SIGNING_TIME: "1.2.840.113549.1.9.5",
} as const;

export type OidKey = keyof typeof OID;
