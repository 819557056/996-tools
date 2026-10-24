import * as a from 'asn1js'
import * as p from 'pkijs'
import { bytesToHex } from '../crypto/material-format'
import { der, name, schema, verifyCertificate } from './core'

const fingerprint = (cert: p.Certificate) => bytesToHex(der(cert))
function constraints(cert: p.Certificate) {
  const extension = cert.extensions?.find(ext => ext.extnID === '2.5.29.19')
  return extension ? new p.BasicConstraints({ schema: schema(extension.extnValue.valueBlock.valueHexView) }) : undefined
}
/** Offline, explicitly anchored path validation. Unsupported policy constraints fail closed. */
export async function validateChain(leaf: p.Certificate, intermediates: p.Certificate[], roots: p.Certificate[], userId = '1234567812345678', at = new Date()) {
  if (!roots.length) throw new Error('请提供明确受信任的根证书 / Explicit trust anchors are required')
  const anchors = new Set(roots.map(fingerprint))
  const pool = [...new Map([...intermediates, ...roots].map(cert => [fingerprint(cert), cert])).values()]
  if (pool.length > 16) throw new Error('证书链最多 16 张 / At most 16 chain certificates')
  const failures: string[] = []
  let attempts = 0
  const supported = new Set(['2.5.29.19', '2.5.29.15', '2.5.29.17', '2.5.29.14', '2.5.29.35', '2.5.29.37'])
  function checkPath(path: p.Certificate[]) {
    for (let i = 0; i < path.length; i++) {
      const cert = path[i]
      if (at < cert.notBefore.value || at > cert.notAfter.value) throw new Error(`证书已过期或尚未生效 / Outside validity: ${name(cert.subject)}`)
      const ids = cert.extensions?.map(ext => ext.extnID) ?? []
      if (new Set(ids).size !== ids.length) throw new Error('证书包含重复扩展 / Duplicate certificate extensions')
      for (const ext of cert.extensions ?? []) {
        if ((ext.critical && !supported.has(ext.extnID)) || ['2.5.29.30', '2.5.29.32', '2.5.29.33', '2.5.29.36', '2.5.29.54'].includes(ext.extnID)) throw new Error(`当前离线验证器不支持约束 / Unsupported constraint: ${ext.extnID}`)
      }
      if (i > 0) {
        const basic = constraints(cert)
        if (!basic?.cA) throw new Error(`签发者没有 CA 权限 / Issuer is not a CA: ${name(cert.subject)}`)
        const usage = cert.extensions?.find(ext => ext.extnID === '2.5.29.15')
        if (usage) {
          const bits = schema(usage.extnValue.valueBlock.valueHexView)
          if (!(bits instanceof a.BitString) || !(bits.valueBlock.valueHexView[0] & 0x04)) throw new Error('签发者 KeyUsage 缺少 keyCertSign / Issuer lacks keyCertSign')
        }
        const below = path.slice(1, i).filter(child => !child.subject.isEqual(child.issuer)).length
        if (basic.pathLenConstraint !== undefined) {
          const limit = typeof basic.pathLenConstraint === 'number' ? basic.pathLenConstraint : basic.pathLenConstraint.valueBlock.valueDec
          if (!Number.isSafeInteger(limit) || limit < 0 || basic.pathLenConstraint instanceof a.Integer && basic.pathLenConstraint.valueBlock.isHexOnly) throw new Error('无法处理 CA 路径长度约束 / Unsupported path length constraint')
          if (below > limit) throw new Error('超过 CA 路径长度约束 / CA path length exceeded')
        }
      }
    }
  }
  async function walk(path: p.Certificate[]): Promise<p.Certificate[] | undefined> {
    if (++attempts > 256) throw new Error('候选路径过多，请减少无关证书 / Too many candidate paths')
    const last = path[path.length - 1]
    if (anchors.has(fingerprint(last))) {
      try { checkPath(path); return path } catch (error) { failures.push((error as Error).message); return }
    }
    for (const issuer of pool) {
      if (!last.issuer.isEqual(issuer.subject) || path.some(cert => fingerprint(cert) === fingerprint(issuer))) continue
      try {
        if (!await verifyCertificate(last, issuer, userId)) { failures.push('证书签名不匹配 / Certificate signature mismatch'); continue }
        const found = await walk([...path, issuer]); if (found) return found
      } catch (error) { failures.push((error as Error).message) }
    }
  }
  const path = await walk([leaf])
  return { valid: !!path, path: path?.map(cert => ({ subject: name(cert.subject), issuer: name(cert.issuer), validFrom: cert.notBefore.value.toISOString(), validTo: cert.notAfter.value.toISOString() })) ?? [], issues: path ? [] : [...new Set(failures.length ? failures : ['无法连接到指定信任根 / No path to the selected trust anchor'])], revocation: '未检查 / Not checked', hostname: '未检查 / Not checked', scope: '签名、有效期、CA、KeyUsage、路径长度及显式信任锚；不支持的策略约束返回失败 / Signatures, dates, CA, KeyUsage, path length and explicit anchors; unsupported policy constraints fail' }
}
