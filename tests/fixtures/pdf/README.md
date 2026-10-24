# PDF 验签测试样本

所有样本均为合成测试文件，只包含测试文字和公开证书。密钥在生成进程内随机创建，不保存在本目录。测试证书不是受信任身份。

| 样本 | 来源及用途 |
| --- | --- |
| `unsigned.pdf` | iText 生成的无签名 PDF |
| `sm2-cms.pdf`、`rsa-cms.pdf`、`ecdsa-cms.pdf` | iText ByteRange + BouncyCastle detached CMS，含 signedAttrs |
| `rsa-direct-cms.pdf` | 不带 signedAttrs 的 RSA detached CMS |
| `rsa-pss-cms.pdf` | SHA-256 / MGF1 SHA-256 / 32 字节 salt 的 RSA-PSS CMS；普通 RSA SPKI |
| `sm2-raw.pdf`、`sm2-signer.cer` | 以 SM3(ByteRange) 为消息的裸 SM2 DER 签名；附公开证书 |
| `sm2-ses.pdf` | 合成 SES v4 外层签名，嵌套印章为占位结构，只用于外层解析/验签 |
| `sm2-service-cms.pdf`、`sm2-service-ses.pdf` | 2026-10-23 移除 Java PDF 模块前，由原 `PdfService` 生成；SES 包含完整电子印章结构，用于兼容性回归 |
| `sm2-xref-stream.pdf` | Flate xref stream、对象流及增量签名 |
| `two-signatures.pdf` | SM2 后追加 RSA 签名，验证不同修订与覆盖范围 |

`tests/helpers/PdfFixtureGenerator.java` 使用独立 iText 9.6.0 和 BouncyCastle 1.84 生成样本，并在写入前使用 BC 独立验证 CMS / SM2 签名，同时确认最终 PDF ByteRange 原始字节与签名输入完全一致。两个 `sm2-service-*` 固定兼容样本来自已删除服务，不由此生成器覆盖。

日常测试只读取这些 PDF，无需 Java、iText 或 PDFBox：

```sh
pnpm test:pdf
```

需要重新生成时，准备 Java 17 和包含 iText kernel、io、layout、forms、sign、commons、BC adapter/connector、BC prov/pkix/util 及 slf4j-api 的 classpath，再执行（PowerShell）：

```powershell
# PDF_FIXTURE_CLASSPATH 由本机测试依赖的 jar 路径组成，Windows 使用分号分隔。
java --class-path $env:PDF_FIXTURE_CLASSPATH tests/helpers/PdfFixtureGenerator.java tests/fixtures/pdf
# 仅补充 RSA-PSS 样本，保留其他样本：
java --class-path $env:PDF_FIXTURE_CLASSPATH tests/helpers/PdfFixtureGenerator.java tests/fixtures/pdf pss-only
```

生成会更换合成身份和签名值，因此二进制内容不保证可逐字节重现。iText 仅用于开发测试样本生成，不在生产依赖及最终 Java jar 中；`pdf-lib` 仅用于测试构造异常 PDF，不参与生产验签。
